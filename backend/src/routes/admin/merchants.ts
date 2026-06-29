import express from "express";
import { z, ZodError } from "zod";
import { prisma } from "../../prisma";
import authMiddleware from "../../middlewares/auth";
import { adminOnly } from "../../middlewares/adminOnly";
import {
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
} from "../../lib/crypto";
import {
  patchMerchantConfig,
  viewIntegration,
} from "../../modules/external/merchants/integration";
import { readMerchantApiConfig } from "../../modules/external/middleware/apiKeyAuth";

const router = express.Router();

router.use(authMiddleware, adminOnly);

const WEBHOOK_BODY = z.object({
  url: z.string().url().max(2048),
  rotate_secret: z.boolean().default(false),
});

router.get("/:id/integration", async (req, res) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: req.params.id } });
  if (!merchant) return res.status(404).json({ ok: false, error: "Merchant not found" });
  return res.json({ ok: true, integration: viewIntegration(merchant) });
});

router.post("/:id/api-key", async (req, res) => {
  try {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.params.id } });
    if (!merchant) return res.status(404).json({ ok: false, error: "Merchant not found" });

    const { keyId, secret, full } = generateApiKey();
    const apiKeyHash = await hashApiKey(secret);

    const updated = await patchMerchantConfig(merchant.id, {
      apiKeyId: keyId,
      apiKeyHash,
    });

    return res.status(201).json({
      ok: true,
      integration: viewIntegration(updated),
      api_key: {
        key_id: keyId,
        secret,
        full,
        warning:
          "Shown once. Store it now — it cannot be recovered. Rotating again invalidates this key.",
      },
    });
  } catch (err) {
    console.error("Issue API key error:", err);
    return res.status(500).json({ ok: false, error: "Failed to issue API key" });
  }
});

router.delete("/:id/api-key", async (req, res) => {
  try {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.params.id } });
    if (!merchant) return res.status(404).json({ ok: false, error: "Merchant not found" });

    const updated = await patchMerchantConfig(merchant.id, {
      apiKeyId: undefined,
      apiKeyHash: undefined,
    });

    return res.json({ ok: true, integration: viewIntegration(updated) });
  } catch (err) {
    console.error("Revoke API key error:", err);
    return res.status(500).json({ ok: false, error: "Failed to revoke API key" });
  }
});

router.put("/:id/webhook", async (req, res) => {
  try {
    const parsed = WEBHOOK_BODY.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        ok: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
    }
    const merchant = await prisma.merchant.findUnique({ where: { id: req.params.id } });
    if (!merchant) return res.status(404).json({ ok: false, error: "Merchant not found" });

    const existing = readMerchantApiConfig(merchant.config);
    const needsSecret = parsed.data.rotate_secret || !existing?.webhookSecret;
    const newSecret = needsSecret ? generateWebhookSecret() : null;

    const patch: Record<string, unknown> = { webhookUrl: parsed.data.url };
    if (newSecret) patch.webhookSecret = newSecret;

    const updated = await patchMerchantConfig(merchant.id, patch);

    return res.json({
      ok: true,
      integration: viewIntegration(updated),
      ...(newSecret
        ? {
            webhook_secret: {
              secret: newSecret,
              warning:
                "Shown once. Store it now — it cannot be recovered. Rotating again invalidates this secret.",
            },
          }
        : {}),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(422).json({
        ok: false,
        error: "Validation failed",
        details: err.flatten(),
      });
    }
    console.error("Set webhook error:", err);
    return res.status(500).json({ ok: false, error: "Failed to set webhook" });
  }
});

router.delete("/:id/webhook", async (req, res) => {
  try {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.params.id } });
    if (!merchant) return res.status(404).json({ ok: false, error: "Merchant not found" });

    const updated = await patchMerchantConfig(merchant.id, {
      webhookUrl: undefined,
      webhookSecret: undefined,
    });

    return res.json({ ok: true, integration: viewIntegration(updated) });
  } catch (err) {
    console.error("Disable webhook error:", err);
    return res.status(500).json({ ok: false, error: "Failed to disable webhook" });
  }
});

export default router;
