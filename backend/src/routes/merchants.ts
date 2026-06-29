import express from "express";
import { prisma } from "../prisma";
import authMiddleware from "../middlewares/auth"; // ✅ FIXED (default import)
import { ConnectorType } from "@prisma/client";
import { sanitizeMerchant } from "../modules/external/merchants/integration";

const router = express.Router();

// =====================
// AUTH WRAPPER
// =====================
const requireAuth = authMiddleware;

// =====================
// GET ALL MERCHANTS
// =====================
router.get("/", requireAuth, async (_req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return res.json({
      ok: true,
      merchants: merchants.map(sanitizeMerchant),
    });
  } catch (error) {
    console.error("Get merchants error:", error);

    return res.status(500).json({
      ok: false,
      error: "Failed to fetch merchants",
    });
  }
});

// =====================
// CREATE MERCHANT
// =====================
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, connector, config } = req.body;

    if (!name) {
      return res.status(400).json({
        ok: false,
        error: "Merchant name is required",
      });
    }

    const merchant = await prisma.merchant.create({
      data: {
        name,
        connector: (connector as ConnectorType) || ConnectorType.CSV,
        config: config || {},
      },
    });

    return res.status(201).json({
      ok: true,
      merchant: sanitizeMerchant(merchant),
    });
  } catch (error) {
    console.error("Create merchant error:", error);

    return res.status(500).json({
      ok: false,
      error: "Failed to create merchant",
    });
  }
});

// =====================
// UPDATE MERCHANT
// =====================
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.merchant.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: "Merchant not found",
      });
    }

    // Defensive: never let the generic dashboard PATCH route overwrite
    // integration secrets — those rotate via the admin endpoints.
    const { config: _config, ...patchableBody } = req.body ?? {};

    const merchant = await prisma.merchant.update({
      where: { id },
      data: patchableBody,
    });

    return res.json({
      ok: true,
      merchant: sanitizeMerchant(merchant),
    });
  } catch (error) {
    console.error("Update merchant error:", error);

    return res.status(500).json({
      ok: false,
      error: "Failed to update merchant",
    });
  }
});

// =====================
// MANUAL SYNC
// =====================
router.post("/:id/sync", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.merchant.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: "Merchant not found",
      });
    }

    const merchant = await prisma.merchant.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
      },
    });

    return res.json({
      ok: true,
      message: "Merchant synced successfully",
      merchant: sanitizeMerchant(merchant),
    });
  } catch (error) {
    console.error("Sync merchant error:", error);

    return res.status(500).json({
      ok: false,
      error: "Failed to sync merchant",
    });
  }
});

export default router;