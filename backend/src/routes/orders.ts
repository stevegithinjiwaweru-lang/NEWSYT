import express from "express";
import { prisma } from "../prisma";
import authMiddleware, { AuthRequest } from "../middlewares/auth";
import { riderOnly } from "../middlewares/riderOnly";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { OrderStatus, PaymentMethod, PaymentStatus, PaymentType, RiderStatus } from "@prisma/client";
import { z } from "zod";
import { io } from "../app";
import {
  publishOrderStatusEvent,
  publishPaymentCollectedEvent,
} from "../modules/external/webhooks/dispatchEvents";

const router = express.Router();
const requireAuth = authMiddleware;

const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const csvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname}`),
});

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) =>
    cb(null, `pod-${Date.now()}-${file.originalname}`),
});

const csvUpload = multer({
  storage: csvStorage,
  fileFilter: (_req, file, cb) => {
    const isCSV =
      file.mimetype === "text/csv" ||
      file.originalname.toLowerCase().endsWith(".csv");
    if (!isCSV) return cb(new Error("Only CSV files allowed"));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const podUpload = multer({
  storage: imageStorage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    lazyConnect: true,
  }
);

connection.on("connect", () => console.log("✅ Redis connected"));
connection.on("error", (err) =>
  console.error("❌ Redis error:", err.message)
);

const csvQueue = new Queue("csv-import", { connection });

async function getRiderIdForUser(userId: string) {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  return rider?.id ?? null;
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const status = req.query.status as OrderStatus | undefined;

    const orders = await prisma.order.findMany({
      where: status ? { status } : {},
      include: { merchant: true, rider: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ ok: true, count: orders.length, orders });
  } catch (error) {
    console.error("List orders error:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch orders" });
  }
});

router.get("/mine", requireAuth, riderOnly, async (req: AuthRequest, res) => {
  try {
    const riderId = await getRiderIdForUser(req.user!.id);

    if (!riderId) {
      return res.status(404).json({ ok: false, error: "Rider profile not found" });
    }

    const orders = await prisma.order.findMany({
      where: { riderId },
      include: { merchant: true, rider: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ ok: true, count: orders.length, orders });
  } catch (error) {
    console.error("My orders error:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch orders" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { merchant: true, rider: true },
    });

    if (!order) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }

    return res.json({ ok: true, order });
  } catch (error) {
    console.error("Get order error:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch order" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { merchantId, customerName, phone, address, amount, paymentType } =
      req.body;

    if (!merchantId || !customerName || !phone || !address) {
      return res.status(400).json({
        ok: false,
        error: "merchantId, customerName, phone, address required",
      });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      return res.status(404).json({ ok: false, error: "Merchant not found" });
    }

    const order = await prisma.order.create({
      data: {
        merchantId,
        customerName,
        phone,
        address,
        amount: Number(amount || 0),
        paymentType: paymentType || PaymentType.COD,
        status: OrderStatus.NEW,
      },
    });

    return res.status(201).json({ ok: true, order });
  } catch (error) {
    console.error("Create order error:", error);
    return res.status(500).json({ ok: false, error: "Failed to create order" });
  }
});

router.patch("/:id/assign", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;

    if (!riderId) {
      return res.status(400).json({ ok: false, error: "riderId required" });
    }

    const rider = await prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) {
      return res.status(404).json({ ok: false, error: "Rider not found" });
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        riderId,
        status: OrderStatus.ASSIGNED,
      },
      include: { merchant: true, rider: true },
    });

    await prisma.rider.update({
      where: { id: riderId },
      data: { status: RiderStatus.BUSY },
    });

    io.to(`rider:${riderId}`).emit("order:assigned", {
      orderId: order.id,
      order,
      message: "New delivery assigned",
    });

    io.to("dashboard").emit("order:assigned", {
      orderId: order.id,
      riderId,
      order,
    });

    await publishOrderStatusEvent(order);

    return res.json({ ok: true, order });
  } catch (error) {
    console.error("Assign rider error:", error);
    return res.status(500).json({ ok: false, error: "Failed to assign rider" });
  }
});

router.patch(
  "/:id/status",
  requireAuth,
  riderOnly,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = Object.values(OrderStatus);
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ ok: false, error: "Invalid status" });
      }

      const riderId = await getRiderIdForUser(req.user!.id);
      const existing = await prisma.order.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ ok: false, error: "Order not found" });
      }

      if (existing.riderId !== riderId) {
        return res.status(403).json({ ok: false, error: "Not your order" });
      }

      const order = await prisma.order.update({
        where: { id },
        data: { status },
        include: { merchant: true, rider: true },
      });

      if (status === OrderStatus.DELIVERED && riderId) {
        await prisma.rider.update({
          where: { id: riderId },
          data: { status: RiderStatus.AVAILABLE },
        });
      } else if (
        [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT].includes(status) &&
        riderId
      ) {
        await prisma.rider.update({
          where: { id: riderId },
          data: { status: RiderStatus.IN_DELIVERY },
        });
      }

      io.to("dashboard").emit("order:tracking:update", {
        orderId: order.id,
        status: order.status,
        riderId: order.riderId,
      });

      if (order.riderId) {
        io.to(`rider:${order.riderId}`).emit("order:updated", {
          orderId: order.id,
          order,
        });
      }

      await publishOrderStatusEvent(order);

      return res.json({ ok: true, order });
    } catch (error) {
      console.error("Status update error:", error);
      return res
        .status(500)
        .json({ ok: false, error: "Failed to update status" });
    }
  }
);

router.post(
  "/:id/pod",
  requireAuth,
  riderOnly,
  podUpload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ ok: false, error: "file required" });
      }

      const riderId = await getRiderIdForUser(req.user!.id);
      const existing = await prisma.order.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ ok: false, error: "Order not found" });
      }

      if (existing.riderId !== riderId) {
        return res.status(403).json({ ok: false, error: "Not your order" });
      }

      const podUrl = `/uploads/${req.file.filename}`;

      const order = await prisma.order.update({
        where: { id },
        data: {
          podUrl,
          status: OrderStatus.DELIVERED,
        },
        include: { merchant: true, rider: true },
      });

      if (riderId) {
        await prisma.rider.update({
          where: { id: riderId },
          data: { status: RiderStatus.AVAILABLE },
        });
      }

      io.to("dashboard").emit("order:tracking:update", {
        orderId: order.id,
        status: order.status,
        riderId: order.riderId,
        podUrl,
      });

      await publishOrderStatusEvent(order);

      return res.json({ ok: true, order, podUrl });
    } catch (error) {
      console.error("POD upload error:", error);
      return res.status(500).json({ ok: false, error: "Failed to upload POD" });
    }
  }
);

const PaymentSchema = z.object({
  method: z.enum(["CASH", "MPESA", "CARD"]),
  amount: z.number().positive(),
  reference: z.string().max(200).optional(),
});

router.post(
  "/:id/payment",
  requireAuth,
  riderOnly,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const parsed = PaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({
          ok: false,
          error: "Validation failed",
          details: parsed.error.flatten(),
        });
      }
      const { method, amount, reference } = parsed.data;

      const riderId = await getRiderIdForUser(req.user!.id);
      const existing = await prisma.order.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ ok: false, error: "Order not found" });
      }
      if (existing.riderId !== riderId) {
        return res.status(403).json({ ok: false, error: "Not your order" });
      }
      if (existing.paymentType !== PaymentType.COD) {
        return res.status(409).json({
          ok: false,
          error: "Order is not COD; payment is not collected on delivery",
        });
      }

      if (existing.paymentStatus === PaymentStatus.COLLECTED) {
        // Idempotent return — rider double-tap protection.
        return res.json({ ok: true, order: existing, alreadyCollected: true });
      }

      const order = await prisma.order.update({
        where: { id },
        data: {
          paymentStatus: PaymentStatus.COLLECTED,
          paymentMethod: method as PaymentMethod,
          amountCollected: amount,
          paymentRef: reference ?? null,
          paidAt: new Date(),
        },
        include: { merchant: true, rider: true },
      });

      await publishPaymentCollectedEvent(order, {
        method: method as PaymentMethod,
        amount,
        reference: reference ?? null,
      });

      return res.json({ ok: true, order });
    } catch (error) {
      console.error("POD payment error:", error);
      return res.status(500).json({ ok: false, error: "Failed to record payment" });
    }
  }
);

router.post(
  "/bulk-csv",
  requireAuth,
  csvUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: "file required" });
      }

      const { merchantId } = req.body;

      await csvQueue.add("process", {
        filePath: req.file.path,
        merchantId,
      });

      return res.json({
        ok: true,
        file: req.file.filename,
        message: "CSV uploaded and queued for processing",
      });
    } catch (error) {
      console.error("CSV upload error:", error);
      return res
        .status(500)
        .json({ ok: false, error: "Failed to queue CSV import" });
    }
  }
);

export default router;
