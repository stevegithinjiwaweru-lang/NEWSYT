import { z } from 'zod';

export const createRiderSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  bikeReg: z.string().optional(),
  branch: z.string().optional(),
  password: z.string().min(6).optional(),
});

export const updateRiderSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(6).optional(),
  bikeReg: z.string().optional(),
  branch: z.string().optional(),
  status: z.string().optional(),
});
