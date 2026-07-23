import { Request, Response } from "express";
import { orderService } from "../services/orderService";
import { prisma } from "../prisma";
import { AuthRequest } from "../middlewares/auth";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { logger } from "../logger";
import { statusForError } from "../utils/httpErrors";

async function resolveRiderId(userId: string): Promise<string | null> {
  const rider = await prisma.rider.findFirst({ where: { userId } });
  return rider?.id ?? null;
}

export async function listOrders(req: Request, res: Response) {
  try {
    const result = await orderService.list(req.query);
    return res.json({ ok: true, ...result });
  } catch (err) {
    logger.error("List orders error", err);
    return res.status(500).json({ ok: false, error: "Failed to list orders" });
  }
}

export async function listMyOrders(req: AuthRequest, res: Response) {
  try {
    const riderId = await resolveRiderId(req.user!.id);
    if (!riderId) return res.status(404).json({ ok: false, error: "No rider profile found for this account" });

    const items = await orderService.listMine(riderId);
    return res.json({ ok: true, items });
  } catch (err) {
    logger.error("List my orders error", err);
    return res.status(500).json({ ok: false, error: "Failed to list your orders" });
  }
}

export async function getOrder(req: Request, res: Response) {
  try {
    const order = await orderService.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: "Order not found" });
    return res.json({ ok: true, order });
  } catch (err) {
    logger.error("Get order error", err);
    return res.status(500).json({ ok: false, error: "Failed to get order" });
  }
}

export async function createOrder(req: Request, res: Response) {
  try {
    const payload = req.body;
    const order = await orderService.create(payload);
    // emit socket event if io is available
    const io = req.app.get("io");
    if (io) io.to("dashboard").emit("order.created", { order });
    return res.status(201).json({ ok: true, order });
  } catch (err) {
    logger.error("Create order error", err);
    return res.status(500).json({ ok: false, error: "Failed to create order" });
  }
}

export async function assignOrder(req: Request, res: Response) {
  try {
    const { riderId } = req.body;
    if (!riderId) return res.status(400).json({ ok: false, error: "riderId required" });

    const order = await orderService.assignToRider(req.params.id, riderId);

    const io = req.app.get("io");
    if (io) {
      io.to(`rider:${riderId}`).emit("order:assigned", { order });
      io.to("dashboard").emit("order:assigned", { order });
    }

    return res.json({ ok: true, order });
  } catch (err: any) {
    logger.error("Assign order error", err);
    const message = err?.message || "Failed to assign order";
    return res.status(statusForError(message)).json({ ok: false, error: message });
  }
}

export async function unassignOrder(req: Request, res: Response) {
  try {
    const order: any = await orderService.unassignRider(req.params.id);

    const io = req.app.get("io");
    if (io) {
      io.to("dashboard").emit("order:unassigned", { order });
    }

    return res.json({ ok: true, order });
  } catch (err: any) {
    logger.error("Unassign order error", err);
    const message = err?.message || "Failed to unassign order";
    return res.status(statusForError(message)).json({ ok: false, error: message });
  }
}

export async function updateOrderStatus(req: AuthRequest, res: Response) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ ok: false, error: "status required" });

    const requesterRiderId =
      req.user?.role === "RIDER" ? await resolveRiderId(req.user.id) : undefined;

    const order = await orderService.updateStatus(req.params.id, status, requesterRiderId ?? undefined);

    const io = req.app.get("io");
    if (io) io.to("dashboard").emit("order:status:update", { order });

    return res.json({ ok: true, order });
  } catch (err: any) {
    logger.error("Update order status error", err);
    const message = err?.message || "Failed to update order status";
    return res.status(statusForError(message)).json({ ok: false, error: message });
  }
}

export async function uploadCsv(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });
    const filepath = req.file.path;
    const raw = fs.readFileSync(filepath, "utf8");
    const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
    let imported = 0;
    const merchantId = req.body.merchantId || req.body.merchantIdResolved;
    for (const rec of records) {
      const created = await orderService.createFromCsvRow(rec, merchantId);
      if (created) imported++;
    }
    // optional: remove file after processing
    // fs.unlinkSync(filepath);
    return res.json({ ok: true, imported });
  } catch (err) {
    logger.error("CSV upload error", err);
    return res.status(500).json({ ok: false, error: "Failed to import CSV" });
  }
}
