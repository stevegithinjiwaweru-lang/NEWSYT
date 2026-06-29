import { Router, Request, Response } from "express";
import IORedis from "ioredis";
import { env } from "../../../config/env";
import { sendError, sendSuccess } from "../../../shared/http/responses";
import { dispatchLocationRateLimit } from "../middleware/dispatchRateLimit";
import { logger } from "../../../shared/logger";
import { prisma } from "../../../prisma";
import {
  assertActive,
  getLatestLocation,
  isTerminalStatus,
  loadDispatchContext,
} from "./location.service";
import { CachedLocation, locationKey } from "./location.cache";

const SSE_HEARTBEAT_MS = 25_000;
const SSE_TERMINAL_CHECK_MS = 30_000;

const router = Router({ mergeParams: true });

router.get("/location", dispatchLocationRateLimit, async (req, res, next) => {
  try {
    const ctx = await loadDispatchContext(req.merchant!.id, req.params.id);
    assertActive(ctx);

    const sample = await getLatestLocation(ctx);
    if (!sample) {
      return sendError(
        res,
        425,
        "NO_LOCATION_YET",
        "No rider location has been recorded for this dispatch yet",
        undefined,
        req.requestId
      );
    }
    return sendSuccess(res, sample);
  } catch (err) {
    next(err);
  }
});

router.get("/track-stream", dispatchLocationRateLimit, async (req, res, next) => {
  let subscriber: IORedis | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let terminalCheckTimer: NodeJS.Timeout | null = null;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (terminalCheckTimer) clearInterval(terminalCheckTimer);
    if (subscriber) {
      subscriber.disconnect();
      subscriber = null;
    }
  };

  try {
    const ctx = await loadDispatchContext(req.merchant!.id, req.params.id);
    assertActive(ctx);

    if (!ctx.riderId) {
      return sendError(
        res,
        425,
        "NO_RIDER_ASSIGNED",
        "No rider has been assigned yet — try again after dispatch.assigned",
        undefined,
        req.requestId
      );
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const writeEvent = (event: string, data: unknown) => {
      if (closed) return;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const initial = await getLatestLocation(ctx);
    if (initial) writeEvent("location", initial);

    subscriber = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      lazyConnect: false,
    });

    const channel = locationKey(ctx.riderId);
    await subscriber.subscribe(channel);

    subscriber.on("message", (_chan, raw) => {
      try {
        const cached = JSON.parse(raw) as CachedLocation;
        writeEvent("location", {
          dispatch_id: ctx.id,
          rider_id: cached.riderId,
          lat: cached.lat,
          lng: cached.lng,
          bearing: cached.bearing ?? null,
          speed_kmh: cached.speed ?? null,
          last_seen_at: cached.lastSeenAt,
          source: "cache",
        });
      } catch (err) {
        logger.warn(
          { err: (err as Error).message, dispatchId: ctx.id },
          "Failed to forward SSE location message"
        );
      }
    });

    heartbeatTimer = setInterval(() => {
      if (!closed) res.write(`: heartbeat\n\n`);
    }, SSE_HEARTBEAT_MS);

    terminalCheckTimer = setInterval(async () => {
      try {
        const fresh = await prisma.order.findUnique({
          where: { id: ctx.id },
          select: { status: true },
        });
        if (!fresh || isTerminalStatus(fresh.status)) {
          writeEvent("closed", { reason: "terminal", status: fresh?.status ?? "GONE" });
          cleanup();
          res.end();
        }
      } catch (err) {
        logger.warn(
          { err: (err as Error).message, dispatchId: ctx.id },
          "Terminal-state check failed; closing SSE"
        );
        cleanup();
        res.end();
      }
    }, SSE_TERMINAL_CHECK_MS);

    req.on("close", cleanup);
    res.on("close", cleanup);
  } catch (err) {
    cleanup();
    next(err);
  }
});

export default router;
