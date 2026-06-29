-- Phase 4: POD payment + cancellations.
-- ROLLBACK: see bottom of file for the inverse statements.

-- =====================================================================
-- 1. New enums
-- =====================================================================
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COLLECTED', 'FAILED', 'NOT_REQUIRED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MPESA', 'CARD');

-- =====================================================================
-- 2. Order: payment outcome columns + cancellation columns
-- =====================================================================
ALTER TABLE "Order"
  ADD COLUMN "paymentStatus"   "PaymentStatus"  NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "paymentMethod"   "PaymentMethod",
  ADD COLUMN "amountCollected" DOUBLE PRECISION,
  ADD COLUMN "paymentRef"      TEXT,
  ADD COLUMN "paidAt"          TIMESTAMP(3),
  ADD COLUMN "cancelledAt"     TIMESTAMP(3),
  ADD COLUMN "cancelReason"    TEXT,
  ADD COLUMN "cancelFee"       DOUBLE PRECISION;

-- Existing COD orders should be marked PENDING so we can collect at the door.
UPDATE "Order"
SET "paymentStatus" = 'PENDING'
WHERE "paymentType" = 'COD' AND "status" <> 'DELIVERED';

-- Delivered COD orders pre-Phase-4 had no payment tracking; mark COLLECTED
-- so they don't show up in dashboards as overdue.
UPDATE "Order"
SET "paymentStatus" = 'COLLECTED', "paidAt" = "updatedAt"
WHERE "paymentType" = 'COD' AND "status" = 'DELIVERED';

-- ROLLBACK:
-- ALTER TABLE "Order"
--   DROP COLUMN "cancelFee",
--   DROP COLUMN "cancelReason",
--   DROP COLUMN "cancelledAt",
--   DROP COLUMN "paidAt",
--   DROP COLUMN "paymentRef",
--   DROP COLUMN "amountCollected",
--   DROP COLUMN "paymentMethod",
--   DROP COLUMN "paymentStatus";
-- DROP TYPE "PaymentMethod";
-- DROP TYPE "PaymentStatus";
