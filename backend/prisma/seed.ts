import {
  UserRole,
  ConnectorType,
  MerchantStatus,
} from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../src/prisma";

/**
 * Create admin user - always created in all environments
 */
async function createAdmin() {
  const phone = "0700000000";
  const existing = await prisma.user.findUnique({ where: { phone } });
  
  if (existing) {
    console.log("✅ Admin already exists");
    return existing;
  }

  const admin = await prisma.user.create({
    data: {
      name: "System Admin",
      phone,
      email: "admin@logistics.local",
      passwordHash: await bcrypt.hash("password123", 10),
      role: UserRole.ADMIN,
    },
  });

  console.log("✅ Admin created: 0700000000 / password123");
  return admin;
}

/**
 * Create default merchants - development only
 */
async function createDefaultMerchants() {
  const merchants = [
    { name: "Carrefour", connector: ConnectorType.CSV },
    { name: "Zucchini", connector: ConnectorType.API },
  ];

  for (const { name, connector } of merchants) {
    const existing = await prisma.merchant.findFirst({ where: { name } });
    
    if (existing) {
      console.log(`✅ Merchant already exists: ${name}`);
      continue;
    }

    await prisma.merchant.create({
      data: {
        name,
        connector,
        status: MerchantStatus.CONNECTED,
        config: connector === ConnectorType.API ? {
          apiKey: process.env.EASYBOX_API_KEY || "dev-key",
          webhookSecret: process.env.EASYBOX_WEBHOOK_SECRET || "dev-secret",
        } : {},
      },
    });

    console.log(`✅ Merchant created: ${name} (${connector})`);
  }
}

async function main() {
  const isProduction = process.env.NODE_ENV === "production";
  
  console.log("🌱 Seeding database...");
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);

  // ALWAYS create admin
  await createAdmin();

  // Only create default merchants in development
  if (!isProduction) {
    console.log("🏪 Creating default merchants...");
    await createDefaultMerchants();
    console.log("✅ Development merchants ready");
  } else {
    console.log("⚠️  Skipping merchant creation in production");
  }

  console.log("🎉 Seed complete");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
