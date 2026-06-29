import { Zone } from "@prisma/client";
import { prisma } from "../../../prisma";
import { NotFoundError } from "../../../shared/errors/AppError";
import { pointInPolygon, parseOperatingHours, OperatingHours, ZonePolygon } from "../../../lib/geo";
import { CreateZoneInput, UpdateZoneInput } from "./zones.dto";

export async function listActiveZones(): Promise<Zone[]> {
  return prisma.zone.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
}

export async function listAllZones(): Promise<Zone[]> {
  return prisma.zone.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getZone(id: string): Promise<Zone> {
  const zone = await prisma.zone.findUnique({ where: { id } });
  if (!zone) throw new NotFoundError("Zone");
  return zone;
}

export async function createZone(input: CreateZoneInput): Promise<Zone> {
  return prisma.zone.create({
    data: {
      name: input.name,
      polygonGeoJson: input.polygonGeoJson as object,
      baseFee: input.baseFee,
      perKmFee: input.perKmFee ?? null,
      currency: input.currency,
      operatingHours: input.operatingHours as object,
      dailyCutoff: input.dailyCutoff ?? null,
      active: input.active,
    },
  });
}

export async function updateZone(id: string, input: UpdateZoneInput): Promise<Zone> {
  await getZone(id);
  return prisma.zone.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.polygonGeoJson !== undefined ? { polygonGeoJson: input.polygonGeoJson as object } : {}),
      ...(input.baseFee !== undefined ? { baseFee: input.baseFee } : {}),
      ...(input.perKmFee !== undefined ? { perKmFee: input.perKmFee } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.operatingHours !== undefined ? { operatingHours: input.operatingHours as object } : {}),
      ...(input.dailyCutoff !== undefined ? { dailyCutoff: input.dailyCutoff } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
}

export async function deleteZone(id: string): Promise<void> {
  await getZone(id);
  await prisma.zone.delete({ where: { id } });
}

export async function findZoneForPoint(coord: { lat: number; lng: number }): Promise<Zone | null> {
  const candidates = await listActiveZones();
  for (const zone of candidates) {
    if (pointInPolygon(coord, zone.polygonGeoJson as unknown as ZonePolygon)) {
      return zone;
    }
  }
  return null;
}

export function readZoneOperatingHours(zone: Zone): OperatingHours | null {
  return parseOperatingHours(zone.operatingHours);
}
