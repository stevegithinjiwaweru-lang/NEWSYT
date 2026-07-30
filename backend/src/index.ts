import { config } from "dotenv";
config();

import logger from "./logger";

// Validate required environment variables
const requiredEnvVars = ["DATABASE_URL"];
const missingEnvVars = requiredEnvVars.filter((env) => !process.env[env]);

if (missingEnvVars.length > 0) {
  logger.error(`❌ Missing required environment variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

import { app, server } from "./app";
import "./socket";
import { waitForDB } from "./utils/waitForDB";

const PORT = Number(process.env.PORT) || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";

async function bootstrap() {
  try {
    logger.info(`🚀 Starting Easybox backend...`);
    logger.info(`📍 Environment: ${NODE_ENV}`);
    logger.info(`🔌 Database: ${process.env.DATABASE_URL?.split("@")[1] || "unknown"}`);

    await waitForDB();

    // cPanel compatibility: listen on all interfaces on assigned port
    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`✅ Easybox backend running on port ${PORT}`);
      logger.info(`📦 Node version: ${process.version}`);
      logger.info(`🌍 CORS enabled for: ${process.env.FRONTEND_URL || "*"}`);
    });
  } catch (err) {
    logger.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

// Graceful shutdown for cPanel
process.on("SIGTERM", () => {
  logger.info("🛑 SIGTERM received, shutting down gracefully...");
  server.close(() => {
    logger.info("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("🛑 SIGINT received, shutting down gracefully...");
  server.close(() => {
    logger.info("✅ Server closed");
    process.exit(0);
  });
});

bootstrap();
