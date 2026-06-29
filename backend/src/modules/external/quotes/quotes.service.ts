import { AppError, ConflictError } from "../../../shared/errors/AppError";
import { haversineKm, isWithinOperatingHours } from "../../../lib/geo";
import { findZoneForPoint, readZoneOperatingHours } from "../zones/zones.service";
import { QuoteRequestInput } from "./quotes.dto";

const AVG_SPEED_KMH = 25;
const ETA_BUCKET_MINUTES = 5;
const QUOTE_TTL_MINUTES = 15;

export interface Quote {
  fee: number;
  currency: string;
  eta_minutes: number;
  distance_km: number;
  zone_id: string;
  zone_name: string;
  operating_hours: { open: string; close: string; tz: string };
  daily_cutoff: string | null;
  accepts_now: boolean;
  expires_at: string;
}

export async function computeQuote(input: QuoteRequestInput): Promise<Quote> {
  const zone = await findZoneForPoint(input.drop_off);
  if (!zone) {
    throw new AppError(
      "Drop-off location is outside all active delivery zones",
      422,
      "OUT_OF_COVERAGE"
    );
  }

  const hours = readZoneOperatingHours(zone);
  if (!hours) {
    throw new ConflictError(
      "Zone is misconfigured (operatingHours invalid)",
      "ZONE_MISCONFIGURED",
      { zoneId: zone.id }
    );
  }

  const distance = haversineKm(input.pickup, input.drop_off);
  const perKm = zone.perKmFee ?? 0;
  const fee = round2(zone.baseFee + perKm * distance);
  const etaMinutes = roundUpTo(distance / AVG_SPEED_KMH * 60, ETA_BUCKET_MINUTES);
  const acceptsNow = isWithinOperatingHours(hours, zone.dailyCutoff ?? null);
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60_000).toISOString();

  return {
    fee,
    currency: zone.currency,
    eta_minutes: etaMinutes,
    distance_km: round2(distance),
    zone_id: zone.id,
    zone_name: zone.name,
    operating_hours: hours,
    daily_cutoff: zone.dailyCutoff ?? null,
    accepts_now: acceptsNow,
    expires_at: expiresAt,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundUpTo(value: number, bucket: number): number {
  return Math.max(bucket, Math.ceil(value / bucket) * bucket);
}
