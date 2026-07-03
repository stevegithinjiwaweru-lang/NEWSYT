import { Request, Response } from "express";
import { orderService } from "../services/orderService";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { logger } from "../logger";

export async function listOrders(req: Request, res: Response) {
  try {
    const result = await orderService.list(req.query);
    return res.json({ ok: true, ...result });
  } catch (err) {
    logger.error("List orders error", err);
    return res.status(500).json({ ok: false, error: "Failed to list orders" });
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
