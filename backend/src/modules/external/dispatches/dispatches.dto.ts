import { z } from "zod";

const e164 = z
  .string()
  .min(7)
  .max(20)
  .regex(/^\+?[0-9]{7,19}$/, "phone must be E.164 or 7-19 digits");

const locationWithAddress = z.object({
  address: z.string().min(1).max(500),
  lat: z.number().gte(-90).lte(90).optional(),
  lng: z.number().gte(-180).lte(180).optional(),
});

export const CreateDispatchSchema = z.object({
  external_id: z.string().min(1).max(120),
  customer: z.object({
    name: z.string().min(1).max(200),
    phone: e164,
  }),
  drop_off: locationWithAddress,
  pickup: locationWithAddress.optional(),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default("KES"),
  payment_type: z.enum(["COD", "PREPAID"]).default("COD"),
  package_notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        sku: z.string().min(1).max(100),
        qty: z.number().int().positive(),
      })
    )
    .optional(),
});

export type CreateDispatchInput = z.infer<typeof CreateDispatchSchema>;

export const ListDispatchQuerySchema = z.object({
  external_id: z.string().min(1).max(120).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListDispatchQuery = z.infer<typeof ListDispatchQuerySchema>;

export const CancelDispatchSchema = z.object({
  reason: z.string().min(1).max(500),
  confirm_fee: z.boolean().default(false),
});

export type CancelDispatchInput = z.infer<typeof CancelDispatchSchema>;
