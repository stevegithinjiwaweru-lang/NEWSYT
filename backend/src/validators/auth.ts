import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().optional(),
  phone: z.string().min(6),
  password: z.string().min(6),
  role: z.string().optional(),
});

export const loginSchema = z.object({
  phone: z.string().min(6),
  password: z.string().min(6),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
