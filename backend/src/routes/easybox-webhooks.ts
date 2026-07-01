import express, { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";
import { io } from "../app";
import { OrderStatus } from "@prisma/client";

const router = express.Router();

/**
 * Verify Easybox webhook signature
 * Signature is HMAC-SHA256 of `{timestamp}.{rawBody}` using EASYBOX_WEBHOOK_SECRET
 */
function verifyEasyboxSignature(
  timestamp: string,
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.EASYBOX_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("⚠️  EASYBOX_WEBHOOK_SECRET not configured");
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const providedSignature = signature.replace(/^sha256=/, "");
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  );
}

/**
 * POST /webhooks/easybox
 * Handle inbound Easybox dispatch webhooks
 *
 * Headers:
 * - X-Easybox-Timestamp: Unix timestamp (seconds)
 * - X-Easybox-Signature: sha256=<hex>
 *
 * Body:
 * {
 *   event: "dispatch.created" | "dispatch.assigned" | "dispatch.picked_up" | "dispatch.en_route" | "dispatch.arrived" | "dispatch.delivered" | "dispatch.failed" | "dispatch.cancelled",
 *   timestamp: "ISO-8601",
 *   data: {
 *     dispatch_id: string,
 *     order_reference: string,
 *     status: string,
 *     rider?: { id, name, phone, vehicle_type?, vehicle_plate? },
 *     location?: { latitude, longitude, accuracy?, timestamp? },
 *     delivered_at?: string,
 *     failure_reason?: string,
 *     metadata?: any
 *   }
 * }
 */
router.post("/", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  try {
    // Get signature headers
    const timestamp = req.get("X-Easybox-Timestamp");
    const signature = req.get("X-Easybox-Signature");

    if (!timestamp || !signature) {
      console.warn("❌ Missing Easybox signature headers");
      return res.status(401).json({
        ok: false,
        error: "Missing signature headers",
      });
    }

    // Verify replay protection (5 minutes)
    const requestTime = parseInt(timestamp) * 1000;
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (now - requestTime > maxAge) {
      console.warn(`⏰ Webhook too old: ${Math.floor((now - requestTime) / 1000)}s`);
      return res.status(401).json({
        ok: false,
        error: "Webhook timestamp too old (replay protection)",
      });
    }

    // Get raw body
    const rawBody = req.body.toString();

    // Verify signature
    if (!verifyEasyboxSignature(timestamp, rawBody, signature)) {
      console.warn("❌ Invalid Easybox signature");
      return res.status(401).json({
        ok: false,
        error: "Invalid signature",
      });
    }

    // Parse body
    const body = JSON.parse(rawBody);
    const { event, data } = body;

    if (!event || !data) {
      return res.status(400).json({
        ok: false,
        error: "Missing event or data",
      });
    }

    console.log(`📥 Easybox webhook: ${event}`, { dispatch_id: data.dispatch_id });

    // Find order by reference
    const order = await prisma.order.findFirst({
      where: { id: data.order_reference },
      include: { rider: true, merchant: true },
    });

    if (!order) {
      console.warn(`⚠️  Order not found: ${data.order_reference}`);
      return res.status(200).json({
        ok: true,
        message: "Webhook received but order not found",
      });
    }

    // Handle dispatch events
    switch (event) {
      case "dispatch.created":
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.ASSIGNED },
        });
        io.to("dashboard").emit("order:tracking:update", {
          orderId: order.id,
          status: "ASSIGNED",
          message: "Dispatch created",
        });
        break;

      case "dispatch.assigned":
        // Rider assigned by Easybox
        if (data.rider) {
          // Create or update rider
          const riderRecord = await prisma.rider.upsert({
            where: { phone: data.rider.phone },
            update: {
              name: data.rider.name,
              status: "AVAILABLE",
            },
            create: {
              phone: data.rider.phone,
              name: data.rider.name,
              status: "AVAILABLE",
            },
          });

          await prisma.order.update({
            where: { id: order.id },
            data: {
              riderId: riderRecord.id,
              status: OrderStatus.ASSIGNED,
            },
          });
        }
        io.to("dashboard").emit("order:tracking:update", {
          orderId: order.id,
          status: "ASSIGNED",
          riderName: data.rider?.name,
        });
        break;

      case "dispatch.picked_up":
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PICKED_UP },
        });
        io.to("dashboard").emit("order:tracking:update", {
          orderId: order.id,
          status: "PICKED_UP",
        });
        break;

      case "dispatch.en_route":
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.IN_TRANSIT },
        });
        // Broadcast location if available
        if (data.location) {
          io.to("dashboard").emit("rider:location:update", {
            riderId: order.riderId,
            lat: data.location.latitude,
            lng: data.location.longitude,
            timestamp: data.location.timestamp,
          });
        }
        io.to("dashboard").emit("order:tracking:update", {
          orderId: order.id,
          status: "IN_TRANSIT",
        });
        break;

      case "dispatch.arrived":
        io.to("dashboard").emit("order:tracking:update", {
          orderId: order.id,
          status: "IN_TRANSIT", // Still in transit, just arrived at location
          message: "Rider arrived at delivery location",
        });
        break;

      case "dispatch.delivered":
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.DELIVERED },
        });
        io.to("dashboard").emit("order:tracking:update", {
          orderId: order.id,
          status: "DELIVERED",
          deliveredAt: data.delivered_at,
        });
        break;

      case "dispatch.failed":
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.FAILED },
        });
        io.to("dashboard").emit("order:tracking:update", {
          orderId: order.id,
          status: "FAILED",
          reason: data.failure_reason,
        });
        break;

      case "dispatch.cancelled":
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.RETURNED },
        });
        io.to("dashboard").emit("order:tracking:update", {
          orderId: order.id,
          status: "RETURNED",
          reason: data.failure_reason,
        });
        break;

      default:
        console.warn(`⚠️  Unknown event: ${event}`);
    }

    res.json({
      ok: true,
      message: `Event ${event} processed`,
    });
  } catch (err: any) {
    console.error("Webhook error:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

export default router;
