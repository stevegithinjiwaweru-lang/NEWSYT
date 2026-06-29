import { Merchant } from "@prisma/client";
import { prisma } from "../../../prisma";
import { readMerchantApiConfig } from "../middleware/apiKeyAuth";

export interface IntegrationView {
  merchant_id: string;
  merchant_name: string;
  api_key: {
    key_id: string;
    configured: boolean;
  } | null;
  webhook: {
    url: string;
    secret_configured: boolean;
  } | null;
}

/**
 * Public-safe view of the merchant integration config. Secrets are never
 * included; we only report whether each piece is configured.
 */
export function viewIntegration(merchant: Merchant): IntegrationView {
  const cfg = readMerchantApiConfig(merchant.config);
  return {
    merchant_id: merchant.id,
    merchant_name: merchant.name,
    api_key: cfg?.apiKeyId
      ? { key_id: cfg.apiKeyId, configured: !!cfg.apiKeyHash }
      : null,
    webhook: cfg?.webhookUrl
      ? { url: cfg.webhookUrl, secret_configured: !!cfg.webhookSecret }
      : null,
  };
}

/**
 * Merge `patch` into the merchant's existing config JSON. Returns the merchant
 * with the new config applied. Caller is responsible for not exposing the
 * full config back to the wire.
 */
export async function patchMerchantConfig(
  merchantId: string,
  patch: Record<string, unknown>
): Promise<Merchant> {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new Error(`Merchant ${merchantId} not found`);
  const current = (merchant.config && typeof merchant.config === "object" ? merchant.config : {}) as Record<string, unknown>;
  const next = { ...current, ...patch };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k];
  }
  return prisma.merchant.update({
    where: { id: merchantId },
    data: { config: next as object },
  });
}

const SENSITIVE_KEYS = new Set(["apiKeyHash", "webhookSecret"]);

/**
 * Strip known sensitive fields from a merchant config blob before returning
 * over HTTP. Pass any value safely — non-objects are returned unchanged.
 */
export function sanitizeMerchantConfig(config: unknown): unknown {
  if (!config || typeof config !== "object") return config;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function sanitizeMerchant(m: Merchant): Merchant {
  return { ...m, config: sanitizeMerchantConfig(m.config) as Merchant["config"] };
}
