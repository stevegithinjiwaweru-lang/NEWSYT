import express from "express";
import { ZodError } from "zod";
import authMiddleware from "../../middlewares/auth";
import { adminOnly } from "../../middlewares/adminOnly";
import { CreateZoneSchema, UpdateZoneSchema } from "../../modules/external/zones/zones.dto";
import {
  createZone,
  deleteZone,
  getZone,
  listAllZones,
  updateZone,
} from "../../modules/external/zones/zones.service";
import { AppError } from "../../shared/errors/AppError";

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.get("/", async (_req, res) => {
  const zones = await listAllZones();
  res.json({ ok: true, count: zones.length, zones });
});

router.get("/:id", async (req, res) => {
  try {
    const zone = await getZone(req.params.id);
    res.json({ ok: true, zone });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    console.error("Get zone error:", err);
    res.status(500).json({ ok: false, error: "Failed to fetch zone" });
  }
});

router.post("/", async (req, res) => {
  try {
    const input = CreateZoneSchema.parse(req.body);
    const zone = await createZone(input);
    res.status(201).json({ ok: true, zone });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(422).json({ ok: false, error: "Validation failed", details: err.flatten() });
    }
    console.error("Create zone error:", err);
    res.status(500).json({ ok: false, error: "Failed to create zone" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const input = UpdateZoneSchema.parse(req.body);
    const zone = await updateZone(req.params.id, input);
    res.json({ ok: true, zone });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(422).json({ ok: false, error: "Validation failed", details: err.flatten() });
    }
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    console.error("Update zone error:", err);
    res.status(500).json({ ok: false, error: "Failed to update zone" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteZone(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    console.error("Delete zone error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete zone" });
  }
});

export default router;
