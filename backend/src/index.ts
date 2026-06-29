import { config } from "dotenv";
config();

import { app, server } from "./app";
import "./socket";
import { waitForDB } from "./utils/waitForDB";

const PORT = Number(process.env.PORT) || 4000;

async function bootstrap() {
  try {
    console.log("🚀 Starting Easybox backend...");

    await waitForDB();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Easybox backend running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

bootstrap();