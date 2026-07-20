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
import easyboxRoutes from "./routes/easybox";
import webhookRoutes from "./routes/webhooks";
import { apiRateLimiter } from "./middlewares/rateLimiter";
import registerSwagger from "./swagger";

export const app = express();

// CORS - allow webhooks from external origins
const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow frontend
    if (!origin || origin === frontend || process.env.NODE_ENV === "development") {
      callback(null, true);
    } else {
      callback(null, true); // Allow webhooks from any origin
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Easybox-Timestamp", "X-Easybox-Signature"],
};

app.use(helmet());
app.use(cors(corsOptions));

// Raw body middleware for webhook signature verification
app.use((req, res, next) => {
  if (req.path.startsWith("/webhooks")) {
    let rawBody = "";
    req.on("data", (chunk: any) => {
      rawBody += chunk.toString();
    });
    req.on("end", () => {
      req.body = JSON.parse(rawBody || "{}");
      req.rawBody = rawBody;
      next();
    });
  } else {
    next();
  }
});

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

// Public routes (webhooks - no auth required)
app.use("/webhooks", webhookRoutes);

// Routes
const api = express.Router();

api.use("/auth", authRoutes);
api.use("/orders", ordersRoutes);
api.use("/riders", ridersRoutes);
api.use("/merchants", merchantsRoutes);
api.use("/dispatches", dispatchRoutes);
api.use("/v1", easyboxRoutes);

app.use("/api", api);

// swagger
registerSwagger(app);

// health
app.get("/api/health", (_req, res) => {
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
