import { NextFunction, Request, Response } from "express";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const updateMeSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

function validate(schema: any) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err: any) {
      return (_res as Response).status(400).json({ error: err.errors ?? err.message });
    }
  };
}

export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateRefresh = validate(refreshSchema);
export const validateUpdateMe = validate(updateMeSchema);
