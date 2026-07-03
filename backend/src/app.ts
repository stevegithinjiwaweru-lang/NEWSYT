import express from "express";
import cors from "cors";
import http from "http";
import { Server as IOServer } from "socket.io";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import { requestLogger } from "./middlewares/requestLogger";
import { errorHandler } from "./middlewares/errorHandler";
import ordersRoutes from "./routes/orders";
import authRoutes from "./routes/auth";
import ridersRoutes from "./routes/riders";
import merchantsRoutes from "./routes/merchants";
import dispatchRoutes from "./routes/dispatches";
import { apiRateLimiter } from "./middlewares/rateLimiter";
import registerSwagger from "./swagger";

export const app = express();

// CORS
const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
const corsOptions = {
  origin: Array.isArray(frontend) ? frontend : frontend,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// uploads dir
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads");
try {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true, mode: 0o755 });
} catch (err) {
  // ignore
}

app.use("/uploads", express.static(UPLOADS_DIR));

// security / rate limit
app.use(apiRateLimiter);

// request logging
app.use(requestLogger);

// routes
app.use("/auth", authRoutes);
app.use("/orders", ordersRoutes);
app.use("/riders", ridersRoutes);
app.use("/merchants", merchantsRoutes);
app.use("/v1/dispatches", dispatchRoutes);

// swagger
registerSwagger(app);

// health
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "easybox-api",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// error handler - LAST
app.use(errorHandler);

// HTTP server + socket.io
const httpServer = http.createServer(app);
export const server = httpServer;

export const io = new IOServer(httpServer, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
  path: "/socket.io/",
  pingInterval: 25000,
  pingTimeout: 20000,
});

// expose io on express app for controllers/services to emit
app.set("io", io);

export default app;
