import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../../../shared/errors/AppError";
import { logger } from "../../../shared/logger";
import { sendError } from "../../../shared/http/responses";
import { env } from "../../../config/env";

export function externalNotFound(_req: Request, res: Response) {
  return sendError(res, 404, "NOT_FOUND", "Endpoint not found");
}

export function externalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = req.requestId;

  if (err instanceof ZodError) {
    err = new ValidationError(err.flatten());
  }

  if (err instanceof AppError) {
    const level = err.statusCode >= 500 ? "error" : "warn";
    logger[level](
      { err: { message: err.message, code: err.code }, requestId, path: req.path },
      "External API error"
    );
    return sendError(res, err.statusCode, err.code, err.message, err.details, requestId);
  }

  const message =
    env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : (err as Error)?.message ?? "Unknown error";

  logger.error(
    { err, requestId, path: req.path },
    "Unhandled error on external API"
  );

  return sendError(res, 500, "INTERNAL_ERROR", message, undefined, requestId);
}
