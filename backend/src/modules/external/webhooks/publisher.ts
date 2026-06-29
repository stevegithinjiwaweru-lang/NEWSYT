import crypto from "crypto";
import { prisma } from "../../../prisma";
import { env } from "../../../config/env";
import { logger } from "../../../shared/logger";
import { readMerchantApiConfig } from "../middleware/apiKeyAuth";
import { webhookQueue } from "./queue";
import { DispatchEventName, WebhookEnvelope } from "./types";

export async function publishDispatchEvent(
  merchantId: string,
  event: DispatchEventName,
  data: Record<string, unknown>
): Promise<void> {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) {
    logger.warn({ merchantId, event }, "publishDispatchEvent: merchant not found");
    return;
  }

  const apiConfig = readMerchantApiConfig(merchant.config);
  if (!apiConfig?.webhookUrl || !apiConfig.webhookSecret) {
    return;
  }

  const occurredAt = new Date().toISOString();
  const envelope: WebhookEnvelope = {
    id: crypto.randomUUID(),
    event,
    occurred_at: occurredAt,
    timestamp: occurredAt,
    data,
  };

  const outbound = await prisma.outboundWebhook.create({
    data: {
      merchantId,
      eventId: envelope.id,
      event,
      payload: envelope as object,
      targetUrl: apiConfig.webhookUrl,
    },
  });

  await webhookQueue.add(
    event,
    { outboundWebhookId: outbound.id },
    {
      attempts: env.WEBHOOK_MAX_ATTEMPTS,
      backoff: { type: "exponential", delay: env.WEBHOOK_BASE_BACKOFF_MS },
      removeOnComplete: { count: 1000 },
      removeOnFail: false,
    }
  );
}
