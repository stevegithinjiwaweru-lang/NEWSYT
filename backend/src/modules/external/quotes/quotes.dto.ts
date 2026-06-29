import { z } from "zod";

const coord = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

export const QuoteRequestSchema = z.object({
  pickup: coord,
  drop_off: coord,
  items: z
    .array(
      z.object({
        sku: z.string().min(1).max(100),
        qty: z.number().int().positive(),
      })
    )
    .optional(),
});

export type QuoteRequestInput = z.infer<typeof QuoteRequestSchema>;
