import express from "express";
import { prisma } from "../prisma";
import authMiddleware from "../middlewares/auth";
import { ConnectorType } from "@prisma/client";

const router = express.Router();
const requireAuth = authMiddleware;

// =====================
// GET ALL MERCHANTS
// =====================
router.get("/", requireAuth, async (_req, res) => {
  try {
    const merchants = await prisma.merchant.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      ok: true,
      merchants,
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

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Merchant name is required and cannot be empty",
      });
    }

    // Check if merchant already exists (avoid duplicates)
    const existing = await prisma.merchant.findFirst({
      where: {
        name: name.trim(),
      },
    });

    if (existing) {
      return res.status(400).json({
        ok: false,
        error: `Merchant '${name}' already exists`,
      });
    }

    const validConnectors = Object.values(ConnectorType);
    const connectorType =
      connector && validConnectors.includes(connector)
        ? connector
        : ConnectorType.CSV;

    const merchant = await prisma.merchant.create({
      data: {
        name: name.trim(),
        connector: connectorType,
        config: config || {},
        status: "CONNECTED",
      },
    });

    console.log(
      `✅ Merchant created: ${merchant.name} (${merchant.connector})`
    );

    return res.status(201).json({
      ok: true,
      message: `Merchant '${merchant.name}' created successfully`,
      merchant,
    });
  } catch (error: any) {
    console.error("Create merchant error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to create merchant",
    });
  }
});

// =====================
// UPDATE MERCHANT
// =====================
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, config } = req.body;

    const existing = await prisma.merchant.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: "Merchant not found",
      });
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined && name.trim()) {
      updateData.name = name.trim();
    }
    if (status !== undefined) {
      updateData.status = status;
    }
    if (config !== undefined) {
      updateData.config = config;
    }
    updateData.updatedAt = new Date();

    const merchant = await prisma.merchant.update({
      where: { id },
      data: updateData,
    });

    console.log(`✅ Merchant updated: ${merchant.name}`);

    return res.json({
      ok: true,
      message: "Merchant updated successfully",
      merchant,
    });
  } catch (error: any) {
    console.error("Update merchant error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to update merchant",
    });
  }
});

// =====================
// MANUAL SYNC (for API-connected merchants)
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

    console.log(`🔄 Merchant synced: ${merchant.name}`);

    return res.json({
      ok: true,
      message: `Merchant '${merchant.name}' synced successfully`,
      merchant,
    });
  } catch (error: any) {
    console.error("Sync merchant error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to sync merchant",
    });
  }
});

export default router;
