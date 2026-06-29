import { Request, Response, NextFunction } from "express";
import { prisma } from "../../../prisma";
import { parseApiKeyHeader, verifyApiKey } from "../../../lib/crypto";
import { UnauthorizedError } from "../../../shared/errors/AppError";

export interface MerchantApiConfig {
  apiKeyId: string;
  apiKeyHash: string;
  webhookUrl?: string;
  webhookSecret?: string;
}

export function readMerchantApiConfig(config: unknown): MerchantApiConfig | null {
  if (!config || typeof config !== "object") return null;
  const c = config as Record<string, unknown>;
  if (typeof c.apiKeyId !== "string" || typeof c.apiKeyHash !== "string") return null;
  return {
    apiKeyId: c.apiKeyId,
    apiKeyHash: c.apiKeyHash,
    webhookUrl: typeof c.webhookUrl === "string" ? c.webhookUrl : undefined,
    webhookSecret: typeof c.webhookSecret === "string" ? c.webhookSecret : undefined,
  };
}

export async function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("x-api-key");
    const parsed = parseApiKeyHeader(header);
    if (!parsed) {
      throw new UnauthorizedError("Missing or malformed API key");
    }

    const merchants = await prisma.merchant.findMany({
      where: { config: { path: ["apiKeyId"], equals: parsed.keyId } },
    });

    const candidate = merchants[0];
    if (!candidate) {
      throw new UnauthorizedError("Invalid API key");
    }

    const apiConfig = readMerchantApiConfig(candidate.config);
    if (!apiConfig) {
      throw new UnauthorizedError("Invalid API key");
    }

    const ok = await verifyApiKey(parsed.secret, apiConfig.apiKeyHash);
    if (!ok) {
      throw new UnauthorizedError("Invalid API key");
    }

    req.merchant = candidate;
    next();
  } catch (err) {
    next(err);
  }
}
