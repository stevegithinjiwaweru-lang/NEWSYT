-- Migration: Add EasyBox V2 additive tables and Order extensions
-- Generated: 2026-07-17

BEGIN;

-- 1) Add OrderType enum (no direct enum in SQL; using text column in new columns referencing application layer)
-- 2) Alter existing "Order" table to add nullable columns
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "orderType" TEXT,
  ADD COLUMN IF NOT EXISTS "customerId" TEXT,
  ADD COLUMN IF NOT EXISTS "pickupLat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "pickupLng" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "dropoffLat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "dropoffLng" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "distanceKm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "estimatedFare" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "actualFare" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "promoCodeId" TEXT,
  ADD COLUMN IF NOT EXISTS "timeline" JSONB;

-- 3) Create Customer table
CREATE TABLE IF NOT EXISTS "Customer" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT UNIQUE,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT UNIQUE,
  "phone" TEXT UNIQUE,
  "passwordHash" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4) Create SavedAddress
CREATE TABLE IF NOT EXISTS "SavedAddress" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" TEXT NOT NULL,
  "label" TEXT,
  "address" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE
);

-- 5) Create Vehicle
CREATE TABLE IF NOT EXISTS "Vehicle" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" TEXT NOT NULL,
  "plateNumber" TEXT,
  "capacity" INTEGER,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6) Create Trip
CREATE TABLE IF NOT EXISTS "Trip" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" TEXT NOT NULL,
  "riderId" TEXT,
  "startAt" TIMESTAMP WITH TIME ZONE,
  "endAt" TIMESTAMP WITH TIME ZONE,
  "distanceKm" DOUBLE PRECISION,
  "durationMin" INTEGER,
  "events" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE
);

-- 7) Create Payment
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" TEXT,
  "method" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "status" TEXT DEFAULT 'PENDING',
  "transactionRef" TEXT,
  "callbackMeta" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL
);

-- 8) Create Wallet
CREATE TABLE IF NOT EXISTS "Wallet" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerType" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "balance" DOUBLE PRECISION DEFAULT 0,
  "currency" TEXT DEFAULT 'KES',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9) Create WalletTransaction
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "walletId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "type" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE
);

-- 10) Create PricingRule
CREATE TABLE IF NOT EXISTS "PricingRule" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "baseFare" DOUBLE PRECISION NOT NULL,
  "perKm" DOUBLE PRECISION NOT NULL,
  "perMinute" DOUBLE PRECISION NOT NULL,
  "vehicleType" TEXT,
  "packageSize" TEXT,
  "isSurgeActive" BOOLEAN DEFAULT false,
  "multiplier" DOUBLE PRECISION DEFAULT 1.0,
  "conditions" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11) Create PromoCode
CREATE TABLE IF NOT EXISTS "PromoCode" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT UNIQUE NOT NULL,
  "description" TEXT,
  "discountType" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "active" BOOLEAN DEFAULT true,
  "usageLimit" INTEGER,
  "expiresAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 12) Create Notification
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "title" TEXT,
  "body" TEXT,
  "meta" JSONB,
  "read" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 13) Create Rating
CREATE TABLE IF NOT EXISTS "Rating" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "raterId" TEXT NOT NULL,
  "ratedId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "comment" TEXT,
  "orderId" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL
);

-- 14) Create SupportTicket
CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" TEXT,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT DEFAULT 'OPEN',
  "assigneeId" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMIT;
