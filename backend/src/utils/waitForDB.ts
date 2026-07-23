import { prisma } from "../prisma";

export async function waitForDB(
  retries = 15,
  delay = 2000
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$runCommandRaw({ ping: 1 });

      console.log("✅ DB connected");
      return;
    } catch (error) {
      console.error(
        `⏳ Waiting for DB (${attempt}/${retries})`
      );

      if (attempt === retries) {
        console.error("❌ Database connection failed");
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, delay)
      );
    }
  }
}