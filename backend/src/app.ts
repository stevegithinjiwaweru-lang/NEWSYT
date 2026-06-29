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

export const app = express();

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());

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
// SOCKET.IO (SINGLETON - DO NOT DUPLICATE ANYWHERE)
// =====================
export const io = new IOServer(httpServer, {
  cors: {
    origin: "*",
  },
});