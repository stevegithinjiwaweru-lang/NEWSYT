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

// Verify dist folder exists in production
if (NODE_ENV === "production") {
  try {
    require.resolve("./app");
    console.log("✅ dist/index.js entry point verified");
  } catch (err) {
    console.error(
      "❌ dist/ folder missing or invalid. Run: npm run build"
    );
    process.exit(1);
  }
}

async function bootstrap() {
  try {
    console.log(`🚀 Starting Easybox backend...`);
    console.log(`📍 Environment: ${NODE_ENV}`);
    console.log(`🔌 Database: ${process.env.DATABASE_URL?.split("@")[1] || "unknown"}`);

    await waitForDB();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Easybox backend running on http://0.0.0.0:${PORT}`);
      console.log(`📦 Node version: ${process.version}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

// Graceful shutdown
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