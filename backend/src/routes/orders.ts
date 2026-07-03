import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { prisma } from "../prisma";

const router = express.Router();

// File upload config
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true, mode: 0o755 }); } catch {}
}

const csvUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  fileFilter: (_req, file, cb) => {
    const lower = (file.originalname || "").toLowerCase();
    if (file.mimetype === "text/csv" || lower.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * Try to detect vendor from filename or header row.
 * Returns 'naivas' | 'carrefour' | null
 */
function detectVendorByFilenameOrHeader(filename: string, headerRow?: string[]): "naivas" | "carrefour" | null {
  const name = (filename || "").toLowerCase();
  if (name.includes("naiv")) return "naivas";
  if (name.includes("carre") || name.includes("carrefour")) return "carrefour";

  if (!headerRow || headerRow.length === 0) return null;
  const headers = headerRow.map((h) => (h || "").toString().toLowerCase());
  if (headers.some(h => h.includes("naivas"))) return "naivas";
  if (headers.some(h => h.includes("carrefour"))) return "carrefour";
  // don't assume vendor from generic headers — return null so other logic can apply
  return null;
}

/**
 * Normalizes header names to lowercase trimmed strings.
 */
function normalizeHeaders(headers: string[]) {
  return headers.map(h => (h || "").toString().trim().toLowerCase());
}

/**
 * Maps a parsed CSV record to the Order.create data shape based on vendor.
 * Mapping uses the sample header you provided:
 * Order ID -> externalId
 * Customer -> customerName
 * Phone -> phone
 * Address -> address
 * Amount -> amount
 * Status -> status
 */
function mapRecordToOrder(record: any, vendor: "naivas" | "carrefour", merchantId: string) {
  const normalized: Record<string, any> = {};
  Object.keys(record).forEach((k) => {
    normalized[k.trim().toLowerCase()] = record[k];
  });

  const externalId = normalized["order id"] ?? normalized["orderid"] ?? normalized["externalid"] ?? null;
  const customerName = normalized["customer"] ?? normalized["customername"] ?? normalized["name"] ?? "";
  const phone = (normalized["phone"] ?? normalized["msisdn"] ?? "").toString();
  const address = normalized["address"] ?? normalized["delivery address"] ?? "";
  const amount = parseFloat(String(normalized["amount"] ?? normalized["value"] ?? "0")) || 0;
  const statusRaw = (normalized["status"] ?? "").toString().toUpperCase();

  const validStatuses = new Set([
    "NEW","ASSIGNED","PICKED_UP","IN_TRANSIT","DELIVERED","FAILED","RETURNED"
  ]);
  const status = validStatuses.has(statusRaw) ? statusRaw : "NEW";

  return {
    externalId: externalId || undefined,
    merchantId,
    customerName: customerName.trim(),
    phone: phone.trim(),
    address: address.trim(),
    amount,
    paymentType: "COD",
    status,
  };
}

/**
 * Resolve merchantId from provided merchantId or merchantName.
 * If merchantName is given and not found, returns null.
 */
async function resolveMerchantId(providedMerchantId?: string, merchantName?: string) {
  if (providedMerchantId) {
    const m = await prisma.merchant.findUnique({ where: { id: providedMerchantId } });
    return m ? m.id : null;
  }
  if (merchantName) {
    const m = await prisma.merchant.findFirst({
      where: { name: { equals: merchantName, mode: "insensitive" } },
    });
    return m ? m.id : null;
  }
  return null;
}

/**
 * Helper to list a small set of merchant names to help users when merchant lookup fails.
 */
async function listMerchantNames(limit = 10) {
  const merchants = await prisma.merchant.findMany({
    take: limit,
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return merchants.map(m => m.name);
}

/**
 * POST /orders
 * Create a new order manually
 * Accepts merchantId OR merchantName
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      merchantId: providedMerchantId,
      merchantName,
      customerName,
      phone,
      address,
      lat,
      lng,
      amount,
      paymentType = "COD",
    } = req.body;

    // Validation
    if (!customerName || !phone || !address || !amount) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: customerName, phone, address, amount",
      });
    }

    // Resolve merchantId from id or name
    let merchantId = await resolveMerchantId(providedMerchantId, merchantName);
    if (!merchantId) {
      // Provide helpful response listing available merchants
      const names = await listMerchantNames();
      return res.status(404).json({
        ok: false,
        error: "Merchant not found",
        message:
          "Provide a valid merchantId or merchantName. Available merchants (sample): " +
          (names.length ? names.join(", ") : "none"),
      });
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
 * POST /orders/upload-csv
 * Accepts file field "file".
 * Accepts merchantId OR merchantName (optional). If omitted, handler attempts to determine merchant by vendor detection.
 */
router.post("/upload-csv", csvUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const providedMerchantId = req.body?.merchantId;
    const merchantName = req.body?.merchantName;

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const filepath = req.file.path;
    const originalName = req.file.originalname;

    // Read header row to help detect vendor when possible
    const raw = fs.readFileSync(filepath, "utf8");
    const parsedHeader = parse(raw, { to_line: 1, relax_column_count: true, trim: true });
    const headerRow = Array.isArray(parsedHeader) && parsedHeader.length > 0 ? parsedHeader[0].map((c: any) => String(c)) : [];

    let vendor = detectVendorByFilenameOrHeader(originalName, headerRow);
    if (!vendor) {
      const headersNorm = normalizeHeaders(headerRow);
      if (headersNorm.some(h => h.includes("naivas"))) vendor = "naivas";
      else if (headersNorm.some(h => h.includes("carrefour"))) vendor = "carrefour";
    }

    // Resolve merchantId from providedMerchantId or merchantName
    let merchantId = await resolveMerchantId(providedMerchantId, merchantName);

    // If merchantId still not resolved, try vendor-based lookup
    if (!merchantId) {
      if (!vendor) {
        try { fs.unlinkSync(filepath); } catch {}
        return res.status(400).json({ ok: false, error: "unsupported_vendor", message: "Only Naivas and Carrefour files are accepted, or provide merchantName/merchantId." });
      }
      const found = await prisma.merchant.findFirst({
        where: { name: { equals: vendor === "naivas" ? "Naivas" : "Carrefour", mode: "insensitive" } },
      });
      if (!found) {
        try { fs.unlinkSync(filepath); } catch {}
        const names = await listMerchantNames();
        return res.status(404).json({
          ok: false,
          error: "merchant_not_found",
          message: `Merchant for vendor '${vendor}' not registered. Available merchants (sample): ${names.join(", ")}`,
        });
      }
      merchantId = found.id;
    }

    // Parse the CSV into records (columns: true)
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!records || records.length === 0) {
      try { fs.unlinkSync(filepath); } catch {}
      return res.status(400).json({ ok: false, error: "CSV file is empty" });
    }

    // Vendor restriction: only process Naivas or Carrefour
    if (vendor && vendor !== "naivas" && vendor !== "carrefour") {
      try { fs.unlinkSync(filepath); } catch {}
      return res.status(400).json({ ok: false, error: "unsupported_vendor", message: "Only Naivas and Carrefour files are accepted" });
    }

    // Map and create orders
    const createdOrders = [];
    for (const rec of records) {
      const mapped = mapRecordToOrder(rec, (vendor as "naivas" | "carrefour") ?? "naivas", merchantId);
      // Basic required checks
      if (!mapped.customerName || !mapped.phone || !mapped.address || !mapped.amount) {
        // skip rows missing required data
        continue;
      }

      // If externalId present, avoid duplicate externalId insertion (unique constraint)
      if (mapped.externalId) {
        const exists = await prisma.order.findUnique({ where: { externalId: mapped.externalId } });
        if (exists) {
          continue;
        }
      }

      const created = await prisma.order.create({
        data: {
          externalId: mapped.externalId,
          merchantId: mapped.merchantId,
          customerName: mapped.customerName,
          phone: mapped.phone,
          address: mapped.address,
          amount: mapped.amount,
          paymentType: mapped.paymentType as any,
          status: mapped.status as any,
        },
      });
      createdOrders.push(created);
    }

    // Optionally delete file after processing
    // try { fs.unlinkSync(filepath); } catch {}

    return res.status(201).json({
      ok: true,
      vendor,
      imported: createdOrders.length,
      orders: createdOrders.slice(0, 10),
    });
  } catch (err: any) {
    if ((req as any).file && (req as any).file.path) {
      try { fs.unlinkSync((req as any).file.path); } catch {}
    }
    console.error("Error uploading CSV:", err);
    return res.status(500).json({ ok: false, error: err.message || "internal_error" });
  }
});

export default router;
