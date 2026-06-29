import { redis } from "../../../config/redis";
import { logger } from "../../../shared/logger";

const KEY_PREFIX = "rider:loc:";
const TTL_SECONDS = 30;

export interface CachedLocation {
  riderId: string;
  lat: number;
  lng: number;
  bearing?: number | null;
  speed?: number | null;
  lastSeenAt: string;
}

export function locationKey(riderId: string): string {
  return `${KEY_PREFIX}${riderId}`;
}

export async function publishLocation(loc: CachedLocation): Promise<void> {
  const key = locationKey(loc.riderId);
  const payload = JSON.stringify(loc);
  try {
    await redis.set(key, payload, "EX", TTL_SECONDS);
    await redis.publish(key, payload);
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, riderId: loc.riderId },
      "Failed to cache/publish rider location"
    );
  }
}

export async function readLocation(riderId: string): Promise<CachedLocation | null> {
  try {
    const raw = await redis.get(locationKey(riderId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedLocation;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, riderId },
      "Failed to read rider location from cache"
    );
    return null;
  }
}
