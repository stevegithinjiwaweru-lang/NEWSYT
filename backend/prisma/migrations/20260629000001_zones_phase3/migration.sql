-- Phase 3: Delivery zones (quotes, fees, operating hours).
-- ROLLBACK: see bottom of file for the inverse statements.

CREATE TABLE "Zone" (
  "id"             TEXT             NOT NULL,
  "name"           TEXT             NOT NULL,
  "polygonGeoJson" JSONB            NOT NULL,
  "baseFee"        DOUBLE PRECISION NOT NULL,
  "perKmFee"       DOUBLE PRECISION,
  "currency"       TEXT             NOT NULL DEFAULT 'KES',
  "operatingHours" JSONB            NOT NULL,
  "dailyCutoff"    TEXT,
  "active"         BOOLEAN          NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Zone_active_idx" ON "Zone"("active");
CREATE INDEX "Zone_name_idx"   ON "Zone"("name");

-- ROLLBACK:
-- DROP INDEX "Zone_name_idx";
-- DROP INDEX "Zone_active_idx";
-- DROP TABLE "Zone";
