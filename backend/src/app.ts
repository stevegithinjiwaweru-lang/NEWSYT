import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import { Server as IOServer } from "socket.io";
import path from "path";
import fs from "fs";

import { env } from "./config/env";

// internal routes (existing dashboard / rider API)
import authRoutes from "./routes/auth";
import ordersRoutes from "./routes/orders";
import ridersRoutes from "./routes/riders";
import merchantsRoutes from "./routes/merchants";
import adminZonesRoutes from "./routes/admin/zones";
import adminMerchantsRoutes from "./routes/admin/merchants";

// external API (api-key + HMAC webhooks)
import externalRoutes from "./modules/external/external.routes";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.includes("*") ? true : env.ALLOWED_ORIGINS,
    credentials: true,
  })
);
app.use(express.json({ limit: "100kb" }));

const UPLOADS_DIR =
  env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use("/uploads", express.static(UPLOADS_DIR));

// Internal API (unchanged)
app.use("/auth", authRoutes);
app.use("/orders", ordersRoutes);
app.use("/riders", ridersRoutes);
app.use("/merchants", merchantsRoutes);

// Internal admin (Phase 3 + integration onboarding)
app.use("/admin/zones", adminZonesRoutes);
app.use("/admin/merchants", adminMerchantsRoutes);

// External API (Phases 1–3)
app.use("/api/v1/external", externalRoutes);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "easybox-api",
    timestamp: new Date().toISOString(),
  });
});

const httpServer = http.createServer(app);
export const server = httpServer;

export const io = new IOServer(httpServer, {
  cors: {
    origin: env.ALLOWED_ORIGINS.includes("*") ? "*" : env.ALLOWED_ORIGINS,
  },
});
