import { z } from 'zod';

export const createMerchantSchema = z.object({
  name: z.string().min(1),
  connector: z.string().optional(),
  config: z.record(z.any()).optional(),
});

export const updateMerchantSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.string().optional(),
  config: z.record(z.any()).optional(),
});
