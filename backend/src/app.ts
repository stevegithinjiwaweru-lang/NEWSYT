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
import dispatchRoutes from "./routes/dispatches";

export const app = express();

// =====================
// CORS MIDDLEWARE (cPanel compatible)
// =====================
const corsOptions = {
  origin: (process.env.FRONTEND_URL || "*").split(",").map(url => url.trim()),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// =====================
// UPLOADS DIRECTORY SETUP (cPanel compatible)
// =====================
// Use relative path from current working directory
const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  path.resolve(process.cwd(), "uploads");

// Ensure uploads directory exists and is writable
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true, mode: 0o755 });
    console.log(`📁 Created uploads directory at: ${UPLOADS_DIR}`);
  }
} catch (err: any) {
  console.warn(`⚠️  Could not create uploads directory: ${err.message}`);
  console.warn(`📁 Uploads will use: ${UPLOADS_DIR}`);
}

// Export uploads directory path for routes to use
export { UPLOADS_DIR };

// static files
app.use("/uploads", express.static(UPLOADS_DIR));

// =====================
// ROUTES
// =====================
app.use("/auth", authRoutes);
app.use("/orders", ordersRoutes);
app.use("/riders", ridersRoutes);
app.use("/merchants", merchantsRoutes);
app.use("/v1/dispatches", dispatchRoutes);

// =====================
// HEALTH CHECK ENDPOINT
// =====================
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "easybox-api",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// =====================
// HTTP SERVER & SOCKET.IO
// =====================
const httpServer = http.createServer(app);
export const server = httpServer;

// Socket.IO with cPanel reverse proxy support
export const io = new IOServer(httpServer, {
  cors: corsOptions,
  transports: ["websocket", "polling"], // Fallback for proxy compatibility
  path: "/socket.io/",
  pingInterval: 25000,
  pingTimeout: 20000,
});

// =====================
// GLOBAL ERROR HANDLER
// =====================
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Unhandled error:", err?.message || err);

  // Multer file filter or validation errors
  if (err.message) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  return res.status(500).json({ ok: false, error: "Internal server error" });
});

// 404 handler
app.use((_req: any, res: any) => {
  res.status(404).json({ ok: false, error: "Route not found" });
});
