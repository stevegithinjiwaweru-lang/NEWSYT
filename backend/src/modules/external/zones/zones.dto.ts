import { z } from "zod";

const HHMM = /^\d{2}:\d{2}$/;
const TZ = /^[A-Za-z]+(?:[_/][A-Za-z]+)+$/;

const ringSchema = z
  .array(z.tuple([z.number(), z.number()]).rest(z.number()))
  .min(4, "polygon ring must have ≥4 coordinates (closed)");

const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(ringSchema).min(1),
});

const multiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(ringSchema).min(1)).min(1),
});

export const PolygonGeoJsonSchema = z.union([polygonSchema, multiPolygonSchema]);

export const OperatingHoursSchema = z.object({
  open: z.string().regex(HHMM, "HH:mm"),
  close: z.string().regex(HHMM, "HH:mm"),
  tz: z.string().regex(TZ, "IANA timezone, e.g. Africa/Nairobi"),
});

export const CreateZoneSchema = z.object({
  name: z.string().min(1).max(120),
  polygonGeoJson: PolygonGeoJsonSchema,
  baseFee: z.number().nonnegative(),
  perKmFee: z.number().nonnegative().optional(),
  currency: z.string().length(3).default("KES"),
  operatingHours: OperatingHoursSchema,
  dailyCutoff: z.string().regex(HHMM).optional(),
  active: z.boolean().default(true),
});

export type CreateZoneInput = z.infer<typeof CreateZoneSchema>;

export const UpdateZoneSchema = CreateZoneSchema.partial();
export type UpdateZoneInput = z.infer<typeof UpdateZoneSchema>;
