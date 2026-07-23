import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import authMiddleware from "../middlewares/auth";
import {
  listOrders,
  listMyOrders,
  getOrder,
  createOrder,
  assignOrder,
  unassignOrder,
  updateOrderStatus,
  uploadCsv,
} from "../controllers/ordersController";

const router = express.Router();
const requireAuth = authMiddleware;

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  fileFilter: (_req, file, cb) => {
    const lower = (file.originalname || "").toLowerCase();
    if (file.mimetype === "text/csv" || lower.endsWith(".csv")) cb(null, true);
    else cb(new Error("Only CSV allowed"));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/", requireAuth, listOrders);
router.get("/mine", requireAuth, listMyOrders);
router.get("/:id", requireAuth, getOrder);
router.post("/", requireAuth, createOrder);
router.post("/:id/assign", requireAuth, assignOrder);
router.post("/:id/unassign", requireAuth, unassignOrder);
router.patch("/:id/status", requireAuth, updateOrderStatus);
router.post("/upload-csv", requireAuth, upload.single("file"), uploadCsv);

export default router;
