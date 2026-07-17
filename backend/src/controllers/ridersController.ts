import { Request, Response } from "express";
import { riderService } from "../services/riderService";
import { logger } from "../logger";

export async function listRiders(req: Request, res: Response) {
  try {
    const result = await riderService.list(req.query);
    return res.json({ ok: true, ...result });
  } catch (err) {
    logger.error("List riders error", err);
    return res.status(500).json({ ok: false, error: "Failed to list riders" });
  }
}

export async function createRider(req: Request, res: Response) {
  try {
    const rider = await riderService.create(req.body);
    return res.status(201).json({ ok: true, rider });
  } catch (err: any) {
    logger.error("Create rider error", err);
    const statusCode = err.message?.includes("already exists") ? 409 : 400;
    return res.status(statusCode).json({ ok: false, error: err.message || "Failed to create rider" });
  }
}

export async function updateRider(req: Request, res: Response) {
  try {
    const rider = await riderService.update(req.params.id, req.body);
    return res.json({ ok: true, rider });
  } catch (err: any) {
    logger.error("Update rider error", err);
    const statusCode = err.message?.includes("not found") ? 404 : 400;
    return res.status(statusCode).json({ ok: false, error: err.message || "Failed to update rider" });
  }
}

export async function deleteRider(req: Request, res: Response) {
  try {
    await riderService.delete(req.params.id);
    return res.json({ ok: true });
  } catch (err: any) {
    logger.error("Delete rider error", err);
    const statusCode = err.message?.includes("not found") ? 404 : 400;
    return res.status(statusCode).json({ ok: false, error: err.message || "Failed to delete rider" });
  }
}