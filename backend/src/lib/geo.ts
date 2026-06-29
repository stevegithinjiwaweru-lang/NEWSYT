import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint, polygon as turfPolygon } from "@turf/helpers";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export type ZonePolygon = GeoJsonPolygon | GeoJsonMultiPolygon;

export function pointInPolygon(
  coord: { lat: number; lng: number },
  geo: ZonePolygon | unknown
): boolean {
  if (!geo || typeof geo !== "object") return false;
  const g = geo as { type?: string; coordinates?: unknown };
  if (g.type !== "Polygon" && g.type !== "MultiPolygon") return false;

  const pt = turfPoint([coord.lng, coord.lat]);

  try {
    if (g.type === "Polygon") {
      return booleanPointInPolygon(pt, turfPolygon(g.coordinates as number[][][]));
    }
    // MultiPolygon: pass for any contained sub-polygon.
    for (const rings of g.coordinates as number[][][][]) {
      if (booleanPointInPolygon(pt, turfPolygon(rings))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export interface OperatingHours {
  open: string;  // "HH:mm"
  close: string; // "HH:mm"
  tz: string;    // IANA timezone, e.g. "Africa/Nairobi"
}

export function parseOperatingHours(raw: unknown): OperatingHours | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.open !== "string" || typeof r.close !== "string" || typeof r.tz !== "string") return null;
  if (!/^\d{2}:\d{2}$/.test(r.open) || !/^\d{2}:\d{2}$/.test(r.close)) return null;
  return { open: r.open, close: r.close, tz: r.tz };
}

function hhmmInTz(date: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });
  return fmt.format(date); // "HH:mm"
}

export function isWithinOperatingHours(
  hours: OperatingHours,
  cutoff: string | null,
  now: Date = new Date()
): boolean {
  const current = hhmmInTz(now, hours.tz);
  const effectiveClose = cutoff && /^\d{2}:\d{2}$/.test(cutoff)
    ? (cutoff < hours.close ? cutoff : hours.close)
    : hours.close;
  return current >= hours.open && current < effectiveClose;
}
