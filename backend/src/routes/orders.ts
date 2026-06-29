import express from "express";
import { prisma } from "../prisma";
import authMiddleware, { AuthRequest } from "../middlewares/auth";
import { riderOnly } from "../middlewares/riderOnly";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { OrderStatus, PaymentType, RiderStatus, ConnectorType } from "@prisma/client";
import { io } from "../app";

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

connection.on("connect", () => console.log("✅ Redis connected for CSV jobs"));
connection.on("error", (err) =>
  console.error("❌ Redis error:", err.message)
);

const csvQueue = new Queue("csv-import", { connection });

async function getRiderIdForUser(userId: string) {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  return rider?.id ?? null;
}

// =====================
// HELPER: Check if merchant can have orders assigned (not CSV-synced Naivas/Carrefour)
// =====================
function canAssignOrdersForMerchant(merchant: any): boolean {
  const restrictedNames = ["naivas", "carrefour"];
  const isRestricted = restrictedNames.some((name) =>
    (merchant.name || "").toLowerCase().includes(name)
  );
  return !isRestricted || merchant.connector !== ConnectorType.CSV;
}

// =====================
// GET ALL ORDERS
// =====================
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

// =====================
// GET RIDER'S ORDERS
// =====================
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

// =====================
// GET SINGLE ORDER
// =====================
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

// =====================
// CREATE ORDER (Manual creation - requires existing merchant)
// =====================
router.post("/", requireAuth, async (req, res) => {
  try {
    const { merchantId, customerName, phone, address, amount, paymentType } =
      req.body;

    // Validation
    if (!merchantId || !customerName || !phone || !address || !amount) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: merchantId, customerName, phone, address, amount",
      });
    }

    // Verify merchant exists
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      return res.status(404).json({
        ok: false,
        error: `Merchant with ID '${merchantId}' not found. Please create the merchant first on the Merchants page.`,
      });
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        merchantId,
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        amount: Number(amount),
        paymentType: paymentType || PaymentType.COD,
        status: OrderStatus.NEW,
      },
      include: { merchant: true },
    });

    console.log(`✅ Manual order created: ${order.id} for merchant ${merchant.name}`);

    return res.status(201).json({ ok: true, order });
  } catch (error: any) {
    console.error("Create order error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to create order",
    });
  }
});

// =====================
// ASSIGN RIDER TO ORDER
// =====================
router.patch("/:id/assign", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;

    if (!riderId) {
      return res.status(400).json({ ok: false, error: "riderId required" });
    }

    // Get order with merchant details
    const order = await prisma.order.findUnique({
      where: { id },
      include: { merchant: true },
    });

    if (!order) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }

    // CHECK: Cannot assign orders from restricted merchants (CSV-synced Naivas/Carrefour)
    if (!canAssignOrdersForMerchant(order.merchant)) {
      return res.status(403).json({
        ok: false,
        error: `Orders from '${order.merchant.name}' are managed by their own system (${order.merchant.connector}). Manual assignment is not allowed.`,
      });
    }

    // Verify rider exists
    const rider = await prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) {
      return res.status(404).json({ ok: false, error: "Rider not found" });
    }

    // Update order with rider assignment
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        riderId,
        status: OrderStatus.ASSIGNED,
      },
      include: { merchant: true, rider: true },
    });

    // Update rider status to BUSY
    await prisma.rider.update({
      where: { id: riderId },
      data: { status: RiderStatus.BUSY },
    });

    // Real-time notifications
    io.to(`rider:${riderId}`).emit("order:assigned", {
      orderId: updatedOrder.id,
      order: updatedOrder,
      message: "New delivery assigned",
    });

    io.to("dashboard").emit("order:assigned", {
      orderId: updatedOrder.id,
      riderId,
      order: updatedOrder,
    });

    console.log(`✅ Order ${id} assigned to rider ${rider.name}`);

    return res.json({ ok: true, order: updatedOrder });
  } catch (error) {
    console.error("Assign rider error:", error);
    return res.status(500).json({ ok: false, error: "Failed to assign rider" });
  }
});

// =====================
// UPDATE ORDER STATUS (Rider only)
// =====================
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

      // Update rider status based on order status
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

      // Broadcast status update
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

      return res.json({ ok: true, order });
    } catch (error) {
      console.error("Status update error:", error);
      return res
        .status(500)
        .json({ ok: false, error: "Failed to update status" });
    }
  }
);

// =====================
// UPLOAD PROOF OF DELIVERY
// =====================
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

      console.log(`✅ POD uploaded for order ${id}`);

      return res.json({ ok: true, order, podUrl });
    } catch (error) {
      console.error("POD upload error:", error);
      return res.status(500).json({ ok: false, error: "Failed to upload POD" });
    }
  }
);

// =====================
// BULK CSV UPLOAD (requires merchantId in request body)
// =====================
router.post(
  "/bulk-csv",
  requireAuth,
  csvUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: "CSV file is required" });
      }

      const { merchantId } = req.body;

      if (!merchantId) {
        return res.status(400).json({
          ok: false,
          error: "merchantId is required in form data",
        });
      }

      // Verify merchant exists
      const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
      });

      if (!merchant) {
        fs.unlink(req.file.path, () => {}); // Clean up uploaded file
        return res.status(404).json({
          ok: false,
          error: `Merchant with ID '${merchantId}' not found`,
        });
      }

      // Queue CSV processing job
      await csvQueue.add("process", {
        filePath: req.file.path,
        merchantId,
        merchantName: merchant.name,
        fileName: req.file.originalname,
      });

      console.log(
        `📁 CSV queued for processing: ${req.file.originalname} -> ${merchant.name}`
      );

      return res.json({
        ok: true,
        file: req.file.filename,
        message: `CSV '${req.file.originalname}' uploaded successfully and queued for processing`,
      });
    } catch (error: any) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      console.error("CSV upload error:", error);
      return res.status(500).json({
        ok: false,
        error: error.message || "Failed to upload CSV",
      });
    }
  }
);

export default router;
