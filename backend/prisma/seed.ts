import {
  ConnectorType,
  MerchantStatus,
  OrderStatus,
  PaymentType,
  RiderStatus,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../src/prisma";

async function createAdmin() {
  const phone = "0700000000";

  const existing = await prisma.user.findUnique({
    where: { phone },
  });

  if (existing) {
    console.log("✅ Admin already exists");
    return existing;
  }

  return prisma.user.create({
    data: {
      name: "System Administrator",
      phone,
      passwordHash: await bcrypt.hash("password123", 10),
      role: UserRole.ADMIN,
    },
  });
}

async function createMerchant(
  name: string,
  connector: ConnectorType
) {
  const existing = await prisma.merchant.findFirst({
    where: { name },
  });

  if (existing) return existing;

  return prisma.merchant.create({
    data: {
      name,
      connector,
      status: MerchantStatus.CONNECTED,
    },
  });
}

async function createRider(
  name: string,
  phone: string,
  bikeReg: string
) {
  const existingUser = await prisma.user.findUnique({
    where: { phone },
  });

  if (existingUser) {
    const rider = await prisma.rider.findFirst({
      where: { userId: existingUser.id },
    });

    return rider;
  }

  const user = await prisma.user.create({
    data: {
      name,
      phone,
      passwordHash: await bcrypt.hash("123456", 10),
      role: UserRole.RIDER,
    },
  });

  return prisma.rider.create({
    data: {
      userId: user.id,
      name,
      phone,
      bikeReg,
      status: RiderStatus.AVAILABLE,
    },
  });
}

async function main() {
  console.log("🌱 Seeding Easybox database...");

  await createAdmin();

  const carrefour = await createMerchant(
    "Carrefour",
    ConnectorType.CSV
  );

  const naivas = await createMerchant(
    "Naivas",
    ConnectorType.CSV
  );

  const zuchinni = await createMerchant(
    "Zuchinni",
    ConnectorType.API
  );

  const rider1 = await createRider(
    "James Kariuki",
    "0712345678",
    "KMCG123A"
  );

  const rider2 = await createRider(
    "Peter Mwangi",
    "0720456789",
    "KMDU456B"
  );

  const orderCount = await prisma.order.count();

  if (orderCount === 0) {
    await prisma.order.createMany({
      data: [
        {
          merchantId: carrefour.id,
          customerName: "John Kamau",
          phone: "0711000001",
          address: "Garden Estate",
          amount: 1250,
          paymentType: PaymentType.COD,
          status: OrderStatus.NEW,
        },
        {
          merchantId: naivas.id,
          customerName: "Mary Wanjiku",
          phone: "0711000002",
          address: "Roysambu",
          amount: 890,
          paymentType: PaymentType.COD,
          status: OrderStatus.NEW,
        },
        {
          merchantId: zuchinni.id,
          customerName: "Peter Otieno",
          phone: "0711000003",
          address: "Kilimani",
          amount: 2400,
          paymentType: PaymentType.PREPAID,
          status: OrderStatus.ASSIGNED,
          riderId: rider1?.id,
        },
      ],
    });
  }

  console.log("✅ Admin created");
  console.log("✅ Merchants created");
  console.log("✅ Riders created");
  console.log("✅ Orders created");
  console.log("🎉 Database seeded successfully");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });