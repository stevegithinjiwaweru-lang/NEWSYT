-- Phase 1: External API foundations (dispatches + status webhooks).
-- ROLLBACK: see bottom of file for the inverse statements.

-- =====================================================================
-- 1. Order enum: add CANCELLED
-- =====================================================================
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- =====================================================================
-- 2. Order: new columns + per-merchant external_id uniqueness + indexes
-- =====================================================================
ALTER TABLE "Order"
  ADD COLUMN "pickupAddress" TEXT,
  ADD COLUMN "pickupLat"     DOUBLE PRECISION,
  ADD COLUMN "pickupLng"     DOUBLE PRECISION,
  ADD COLUMN "packageNotes"  TEXT,
  ADD COLUMN "etaMinutes"    INTEGER;

-- Drop the global unique on externalId (existing init migration created it).
DROP INDEX IF EXISTS "Order_externalId_key";

CREATE UNIQUE INDEX "Order_merchantId_externalId_key"
  ON "Order"("merchantId", "externalId");

CREATE INDEX "Order_status_idx"  ON "Order"("status");
CREATE INDEX "Order_riderId_idx" ON "Order"("riderId");

-- =====================================================================
-- 3. IdempotencyKey table
-- =====================================================================
CREATE TABLE "IdempotencyKey" (
  "id"           TEXT      NOT NULL,
  "merchantId"   TEXT      NOT NULL,
  "key"          TEXT      NOT NULL,
  "requestHash"  TEXT      NOT NULL,
  "statusCode"   INTEGER   NOT NULL,
  "responseBody" JSONB     NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_merchantId_key_key"
  ON "IdempotencyKey"("merchantId", "key");

CREATE INDEX "IdempotencyKey_createdAt_idx"
  ON "IdempotencyKey"("createdAt");

ALTER TABLE "IdempotencyKey"
  ADD CONSTRAINT "IdempotencyKey_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- 4. WebhookDeliveryStatus enum + OutboundWebhook table
-- =====================================================================
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

CREATE TABLE "OutboundWebhook" (
  "id"          TEXT                    NOT NULL,
  "merchantId"  TEXT                    NOT NULL,
  "eventId"     TEXT                    NOT NULL,
  "event"       TEXT                    NOT NULL,
  "payload"     JSONB                   NOT NULL,
  "targetUrl"   TEXT                    NOT NULL,
  "status"      "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"    INTEGER                 NOT NULL DEFAULT 0,
  "lastError"   TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)            NOT NULL,
  CONSTRAINT "OutboundWebhook_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboundWebhook_eventId_key"
  ON "OutboundWebhook"("eventId");

CREATE INDEX "OutboundWebhook_merchantId_createdAt_idx"
  ON "OutboundWebhook"("merchantId", "createdAt");

CREATE INDEX "OutboundWebhook_status_attempts_idx"
  ON "OutboundWebhook"("status", "attempts");

ALTER TABLE "OutboundWebhook"
  ADD CONSTRAINT "OutboundWebhook_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- ROLLBACK (manual; Prisma does not auto-rollback):
--
-- DROP TABLE "OutboundWebhook";
-- DROP TYPE "WebhookDeliveryStatus";
-- DROP TABLE "IdempotencyKey";
-- DROP INDEX "Order_riderId_idx";
-- DROP INDEX "Order_status_idx";
-- DROP INDEX "Order_merchantId_externalId_key";
-- CREATE UNIQUE INDEX "Order_externalId_key" ON "Order"("externalId");
-- ALTER TABLE "Order"
--   DROP COLUMN "etaMinutes",
--   DROP COLUMN "packageNotes",
--   DROP COLUMN "pickupLng",
--   DROP COLUMN "pickupLat",
--   DROP COLUMN "pickupAddress";
-- Note: Postgres does not support removing an enum value without recreating
-- the type. To roll back CANCELLED, rebuild the enum.
