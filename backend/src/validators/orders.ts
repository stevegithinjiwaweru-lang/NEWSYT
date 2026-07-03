import { z } from "zod";

export const createOrderSchema = z.object({
  merchantId: z.string().optional(),
  merchantName: z.string().optional(),
  customerName: z.string().min(1),
  phone: z.string().min(6),
  address: z.string().min(1),
  amount: z.union([z.number(), z.string().regex(/^[0-9.]+$/)]).transform((v) => Number(v)),
  paymentType: z.enum(["COD", "PREPAID"]).optional(),
});
