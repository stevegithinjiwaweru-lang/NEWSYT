import { config } from "dotenv";
config();

// Validate required environment variables
const requiredEnvVars = ["DATABASE_URL"];
const missingEnvVars = requiredEnvVars.filter((env) => !process.env[env]);

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
  process.exit(1);
}

import { app, server } from "./app";
import "./socket";
import { waitForDB } from "./utils/waitForDB";

const PORT = Number(process.env.PORT) || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";

async function bootstrap() {
  try {
    console.log(`🚀 Starting Easybox backend...`);
    console.log(`📍 Environment: ${NODE_ENV}`);
    console.log(`🔌 Database: ${process.env.DATABASE_URL?.split("@")[1] || "unknown"}`);

    await waitForDB();

    // cPanel compatibility: listen on all interfaces on assigned port
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Easybox backend running on port ${PORT}`);
      console.log(`📦 Node version: ${process.version}`);
      console.log(`🌍 CORS enabled for: ${process.env.FRONTEND_URL || "*"}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

// Graceful shutdown for cPanel
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

bootstrap();
