import { Request, Response, NextFunction } from "express";
import { prisma } from "../../../prisma";
import { hashRequest } from "../../../lib/crypto";
import { ConflictError, ValidationError } from "../../../shared/errors/AppError";

const KEY_HEADER = "idempotency-key";
const KEY_REGEX = /^[A-Za-z0-9_\-]{8,128}$/;

export function requireIdempotency(req: Request, _res: Response, next: NextFunction) {
  try {
    const key = req.header(KEY_HEADER);
    if (!key) {
      throw new ValidationError(
        { header: KEY_HEADER },
        `Missing required header: ${KEY_HEADER}`
      );
    }
    if (!KEY_REGEX.test(key)) {
      throw new ValidationError(
        { header: KEY_HEADER },
        `Invalid ${KEY_HEADER} format (8-128 chars, [A-Za-z0-9_-])`
      );
    }
    const requestHash = hashRequest(req.method, req.originalUrl, req.body);
    req.idempotency = { key, requestHash };
    next();
  } catch (err) {
    next(err);
  }
}

export async function checkIdempotencyReplay(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.idempotency || !req.merchant) return next();

    const existing = await prisma.idempotencyKey.findUnique({
      where: {
        merchantId_key: { merchantId: req.merchant.id, key: req.idempotency.key },
      },
    });

    if (!existing) return next();

    if (existing.requestHash !== req.idempotency.requestHash) {
      throw new ConflictError(
        "Idempotency-Key already used with a different request body",
        "IDEMPOTENCY_KEY_REUSED"
      );
    }

    return res.status(existing.statusCode).json(existing.responseBody);
  } catch (err) {
    next(err);
  }
}

export async function recordIdempotentResponse(
  merchantId: string,
  key: string,
  requestHash: string,
  statusCode: number,
  responseBody: unknown
): Promise<void> {
  await prisma.idempotencyKey.create({
    data: {
      merchantId,
      key,
      requestHash,
      statusCode,
      responseBody: responseBody as object,
    },
  });
}
