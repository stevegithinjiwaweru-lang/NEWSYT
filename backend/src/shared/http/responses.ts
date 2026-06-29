import { Response } from "express";

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>
): Response {
  const body: SuccessEnvelope<T> = meta
    ? { success: true, data, meta }
    : { success: true, data };
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
  requestId?: string
): Response {
  const body: ErrorEnvelope = {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}), ...(requestId ? { requestId } : {}) },
  };
  return res.status(statusCode).json(body);
}
