import express from "express";
import cors from "cors";
import http from "http";
import { Server as IOServer } from "socket.io";
import path from "path";
import fs from "fs";

// routes
import authRoutes from "./routes/auth";
import ordersRoutes from "./routes/orders";
import ridersRoutes from "./routes/riders";
import merchantsRoutes from "./routes/merchants";
import easyboxWebhookRoutes from "./routes/easybox-webhooks";

export const app = express();

// =====================
// MIDDLEWARE
// =====================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// =====================
// UPLOADS SETUP (Docker safe)
// =====================
const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// static files
app.use("/uploads", express.static(UPLOADS_DIR));

// =====================
// ROUTES
// =====================
app.use("/auth", authRoutes);
app.use("/orders", ordersRoutes);
app.use("/riders", ridersRoutes);
app.use("/merchants", merchantsRoutes);

// =====================
// EASYBOX WEBHOOKS (no auth required)
// =====================
app.use("/webhooks/easybox", easyboxWebhookRoutes);

// =====================
// HEALTH CHECK
// =====================
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "easybox-api",
    timestamp: new Date().toISOString(),
  });
});

// =====================
// HTTP SERVER
// =====================
const httpServer = http.createServer(app);
export const server = httpServer;

// =====================
// SOCKET.IO
// =====================
export const io = new IOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// =====================
// GLOBAL ERROR HANDLER
// =====================
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Unhandled error:", err && err.message ? err.message : err);

  if (err && err.message && err.message.includes("Only CSV files are allowed")) {
    return res.status(400).json({
      ok: false,
      error: "Invalid file type. Only CSV files are allowed.",
    });
  }

  res.status(500).json({
    ok: false,
    error: "Internal server error",
  });
});
