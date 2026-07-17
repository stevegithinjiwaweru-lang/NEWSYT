import { Request, Response } from "express";
import { merchantService } from "../services/merchantService";
import { logger } from "../logger";

export async function listMerchants(req: Request, res: Response) {
  try {
    const result = await merchantService.list(req.query);
    return res.json({ ok: true, ...result });
  } catch (err) {
    logger.error("List merchants error", err);
    return res.status(500).json({ ok: false, error: "Failed to list merchants" });
  }
}

export async function createMerchant(req: Request, res: Response) {
  try {
    const merchant = await merchantService.create(req.body);
    return res.status(201).json({ ok: true, merchant });
  } catch (err: any) {
    logger.error("Create merchant error", err);
    const statusCode = err.message?.includes("already exists") ? 409 : 400;
    return res.status(statusCode).json({ ok: false, error: err.message || "Failed to create merchant" });
  }
}

export async function updateMerchant(req: Request, res: Response) {
  try {
    const merchant = await merchantService.update(req.params.id, req.body);
    return res.json({ ok: true, merchant });
  } catch (err: any) {
    logger.error("Update merchant error", err);
    const statusCode = err.message?.includes("not found") ? 404 : 400;
    return res.status(statusCode).json({ ok: false, error: err.message || "Failed to update merchant" });
  }
}