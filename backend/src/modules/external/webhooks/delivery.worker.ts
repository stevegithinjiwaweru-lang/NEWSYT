import "dotenv/config";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../../../prisma";
import { env } from "../../../config/env";
import { logger } from "../../../shared/logger";
import { signWebhookPayload } from "../../../lib/crypto";
import { readMerchantApiConfig } from "../middleware/apiKeyAuth";
import { WEBHOOK_QUEUE_NAME, WebhookJobData } from "./queue";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true,
});

async function deliver(job: Job<WebhookJobData>): Promise<void> {
  const { outboundWebhookId } = job.data;

  const record = await prisma.outboundWebhook.findUnique({
    where: { id: outboundWebhookId },
    include: { merchant: true },
  });

  if (!record) {
    logger.warn({ outboundWebhookId }, "OutboundWebhook row not found, dropping");
    return;
  }

  const apiConfig = readMerchantApiConfig(record.merchant.config);
  if (!apiConfig?.webhookSecret) {
    await prisma.outboundWebhook.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: "Merchant webhookSecret missing",
      },
    });
    throw new Error("Merchant webhookSecret missing");
  }

  const body = JSON.stringify(record.payload);
  const { signatureHeader, timestampHeader } = signWebhookPayload(body, apiConfig.webhookSecret);

  let response: Response;
  try {
    response = await fetch(record.targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Easybox-Event": record.event,
        "X-Easybox-Signature": signatureHeader,
        "X-Easybox-Timestamp": timestampHeader,
        "X-Easybox-Event-Id": record.eventId,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const message = (err as Error)?.message ?? "fetch failed";
    await prisma.outboundWebhook.update({
      where: { id: record.id },
      data: {
        attempts: { increment: 1 },
        lastError: `network: ${message}`,
        status:
          job.attemptsMade + 1 >= (job.opts.attempts ?? env.WEBHOOK_MAX_ATTEMPTS)
            ? "FAILED"
            : "PENDING",
      },
    });
    throw err;
  }

  if (response.status >= 200 && response.status < 300) {
    await prisma.outboundWebhook.update({
      where: { id: record.id },
      data: {
        attempts: { increment: 1 },
        status: "SUCCESS",
        lastError: null,
        deliveredAt: new Date(),
      },
    });
    logger.info(
      { event: record.event, eventId: record.eventId, merchantId: record.merchantId, status: response.status },
      "Webhook delivered"
    );
    return;
  }

  const text = await response.text().catch(() => "");
  await prisma.outboundWebhook.update({
    where: { id: record.id },
    data: {
      attempts: { increment: 1 },
      lastError: `${response.status}: ${text.slice(0, 500)}`,
      status:
        job.attemptsMade + 1 >= (job.opts.attempts ?? env.WEBHOOK_MAX_ATTEMPTS)
          ? "FAILED"
          : "PENDING",
    },
  });

  throw new Error(`Webhook target returned ${response.status}`);
}

const worker = new Worker<WebhookJobData>(WEBHOOK_QUEUE_NAME, deliver, {
  connection,
  concurrency: 8,
});

worker.on("completed", (job) =>
  logger.debug({ jobId: job.id }, "Webhook job completed")
);

worker.on("failed", (job, err) =>
  logger.warn(
    { jobId: job?.id, attemptsMade: job?.attemptsMade, err: err.message },
    "Webhook job failed (will retry until attempts exhausted)"
  )
);

logger.info({ queue: WEBHOOK_QUEUE_NAME }, "Webhook delivery worker started");
