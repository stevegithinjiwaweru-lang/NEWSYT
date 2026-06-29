import { OrderStatus } from "@prisma/client";
import { prisma } from "../../../prisma";
import { ConflictError, NotFoundError } from "../../../shared/errors/AppError";
import { readLocation } from "./location.cache";

const TERMINAL_STATUSES: OrderStatus[] = ["DELIVERED", "FAILED", "RETURNED", "CANCELLED"];

export interface LocationSample {
  dispatch_id: string;
  rider_id: string;
  lat: number;
  lng: number;
  bearing: number | null;
  speed_kmh: number | null;
  last_seen_at: string;
  source: "cache" | "db";
}

export interface DispatchContext {
  id: string;
  riderId: string | null;
  status: OrderStatus;
}

export async function loadDispatchContext(
  merchantId: string,
  dispatchId: string
): Promise<DispatchContext> {
  const order = await prisma.order.findFirst({
    where: { id: dispatchId, merchantId },
    select: { id: true, riderId: true, status: true },
  });
  if (!order) throw new NotFoundError("Dispatch");
  return order;
}

export function assertActive(ctx: DispatchContext): void {
  if (TERMINAL_STATUSES.includes(ctx.status)) {
    throw new ConflictError(
      `Dispatch is in terminal state (${ctx.status})`,
      "TERMINAL_STATE",
      { status: ctx.status }
    );
  }
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export async function getLatestLocation(
  ctx: DispatchContext
): Promise<LocationSample | null> {
  if (!ctx.riderId) return null;

  const cached = await readLocation(ctx.riderId);
  if (cached) {
    return {
      dispatch_id: ctx.id,
      rider_id: ctx.riderId,
      lat: cached.lat,
      lng: cached.lng,
      bearing: cached.bearing ?? null,
      speed_kmh: cached.speed ?? null,
      last_seen_at: cached.lastSeenAt,
      source: "cache",
    };
  }

  const rider = await prisma.rider.findUnique({
    where: { id: ctx.riderId },
    select: { id: true, lastLat: true, lastLng: true, lastSeenAt: true },
  });

  if (!rider || rider.lastLat === null || rider.lastLng === null || !rider.lastSeenAt) {
    return null;
  }

  return {
    dispatch_id: ctx.id,
    rider_id: rider.id,
    lat: rider.lastLat,
    lng: rider.lastLng,
    bearing: null,
    speed_kmh: null,
    last_seen_at: rider.lastSeenAt.toISOString(),
    source: "db",
  };
}
