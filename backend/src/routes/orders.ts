import express, { Request, Response } from "express";
import multer, { Multer } from "multer";
import path from "path";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { prisma } from "../prisma";

const router = express.Router();

// File upload config
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

const csvUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname}`),
  }),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

const podUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) =>
      cb(null, `pod-${Date.now()}-${file.originalname}`),
  }),
});

/**
 * GET /orders
 * Fetch all orders with optional filters
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { merchantId, status, riderId } = req.query;

    const filters: any = {};
    if (merchantId) filters.merchantId = merchantId as string;
    if (status) filters.status = status as string;
    if (riderId) filters.riderId = riderId as string;

    const orders = await prisma.order.findMany({
      where: filters,
      include: {
        merchant: true,
        rider: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ ok: true, orders });
  } catch (err: any) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /orders/:id
 * Fetch single order by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        merchant: true,
        rider: true,
      },
    });

    if (!order) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }

    res.json({ ok: true, order });
  } catch (err: any) {
    console.error("Error fetching order:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /orders
 * Create a new order manually
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      merchantId,
      customerName,
      phone,
      address,
      lat,
      lng,
      amount,
      paymentType = "COD",
    } = req.body;

    // Validation
    if (!merchantId || !customerName || !phone || !address || !amount) {
      return res.status(400).json({
        ok: false,
        error:
          "Missing required fields: merchantId, customerName, phone, address, amount",
      });
    }

    // Verify merchant exists
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
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        amount: parseFloat(amount),
        paymentType,
        status: "NEW",
      },
      include: {
        merchant: true,
        rider: true,
      },
    });

    res.status(201).json({ ok: true, order });
  } catch (err: any) {
    console.error("Error creating order:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PUT /orders/:id
 * Update an order
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      phone,
      address,
      lat,
      lng,
      amount,
      paymentType,
      status,
      riderId,
    } = req.body;

    const updateData: any = {};
    if (customerName) updateData.customerName = customerName;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (lat !== undefined) updateData.lat = lat ? parseFloat(lat) : null;
    if (lng !== undefined) updateData.lng = lng ? parseFloat(lng) : null;
    if (amount) updateData.amount = parseFloat(amount);
    if (paymentType) updateData.paymentType = paymentType;
    if (status) updateData.status = status;
    if (riderId !== undefined) updateData.riderId = riderId || null;

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        merchant: true,
        rider: true,
      },
    });

    res.json({ ok: true, order });
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }
    console.error("Error updating order:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * DELETE /orders/:id
 * Delete an order
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.order.delete({
      where: { id },
    });

    res.json({ ok: true, message: "Order deleted successfully" });
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }
    console.error("Error deleting order:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /orders/bulk-assign
 * Assign multiple orders to a rider
 */
router.post("/bulk-assign", async (req: Request, res: Response) => {
  try {
    const { riderId, orderIds } = req.body;

    if (!riderId || !orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({
        ok: false,
        error: "Missing or invalid: riderId, orderIds",
      });
    }

    // Verify rider exists
    const rider = await prisma.rider.findUnique({
      where: { id: riderId },
    });

    if (!rider) {
      return res.status(404).json({ ok: false, error: "Rider not found" });
    }

    const orders = await prisma.order.updateMany({
      where: {
        id: { in: orderIds },
      },
      data: {
        riderId,
        status: "ASSIGNED",
      },
    });

    res.json({
      ok: true,
      message: `${orders.count} orders assigned to rider`,
    });
  } catch (err: any) {
    console.error("Error bulk assigning orders:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /orders/:id/assign
 * Assign a single order to a rider
 */
router.post("/:id/assign", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;

    if (!riderId) {
      return res.status(400).json({ ok: false, error: "riderId is required" });
    }

    // Verify rider exists
    const rider = await prisma.rider.findUnique({
      where: { id: riderId },
    });

    if (!rider) {
      return res.status(404).json({ ok: false, error: "Rider not found" });
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        riderId,
        status: "ASSIGNED",
      },
      include: {
        merchant: true,
        rider: true,
      },
    });

    res.json({ ok: true, order });
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }
    console.error("Error assigning order:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /orders/upload-csv
 * Upload CSV file and create orders
 * Expected CSV columns: customerName, phone, address, amount, paymentType (optional), lat (optional), lng (optional)
 */
router.post(
  "/upload-csv",
  csvUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const { merchantId } = req.body;

      if (!merchantId) {
        return res
          .status(400)
          .json({ ok: false, error: "merchantId is required" });
      }

      if (!req.file) {
        return res.status(400).json({ ok: false, error: "No file uploaded" });
      }

      // Verify merchant exists
      const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
      });

      if (!merchant) {
        // Clean up file
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ ok: false, error: "Merchant not found" });
      }

      // Read and parse CSV
      const fileContent = fs.readFileSync(req.file.path, "utf-8");
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      if (!records || records.length === 0) {
        fs.unlinkSync(req.file.path);
        return res
          .status(400)
          .json({ ok: false, error: "CSV file is empty" });
      }

      // Validate required columns
      const requiredColumns = ["customerName", "phone", "address", "amount"];
      const firstRecord = records[0];
      const missingColumns = requiredColumns.filter((col) => !(col in firstRecord));

      if (missingColumns.length > 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          ok: false,
          error: `Missing CSV columns: ${missingColumns.join(", ")}`,
        });
      }

      // Create orders from CSV records
      const createdOrders = await Promise.all(
        records.map((record: any) =>
          prisma.order.create({
            data: {
              merchantId,
              customerName: record.customerName.trim(),
              phone: record.phone.trim(),
              address: record.address.trim(),
              amount: parseFloat(record.amount),
              paymentType: record.paymentType?.trim() || "COD",
              status: "NEW",
              lat: record.lat ? parseFloat(record.lat) : null,
              lng: record.lng ? parseFloat(record.lng) : null,
            },
          })
        )
      );

      res.status(201).json({
        ok: true,
        message: `Successfully imported ${createdOrders.length} orders`,
        count: createdOrders.length,
        orders: createdOrders,
      });
    } catch (err: any) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      console.error("Error uploading CSV:", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

/**
 * POST /orders/:id/upload-pod
 * Upload proof of delivery
 */
router.post(
  "/:id/upload-pod",
  podUpload.single("pod"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ ok: false, error: "No file uploaded" });
      }

      const order = await prisma.order.update({
        where: { id },
        data: {
          podUrl: `/uploads/${req.file.filename}`,
          status: "DELIVERED",
        },
        include: {
          merchant: true,
          rider: true,
        },
      });

      res.json({ ok: true, order });
    } catch (err: any) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      if (err.code === "P2025") {
        return res.status(404).json({ ok: false, error: "Order not found" });
      }
      console.error("Error uploading POD:", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

export default router;
