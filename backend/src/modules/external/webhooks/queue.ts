import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../../../config/env";

export const WEBHOOK_QUEUE_NAME = "webhook-delivery";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true,
});

export const webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, { connection });

export interface WebhookJobData {
  outboundWebhookId: string;
}
