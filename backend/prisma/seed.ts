import {
  UserRole,
  ConnectorType,
  MerchantStatus,
  PaymentType,
  OrderStatus,
  RiderStatus,
} from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../src/prisma";

async function createAdmin() {
  const phone = "0700000000";
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      name: "Admin",
      phone,
      passwordHash: await bcrypt.hash("password123", 10),
      role: UserRole.ADMIN,
    },
  });
}

async function createMerchant(name: string, connector: ConnectorType) {
  const existing = await prisma.merchant.findFirst({ where: { name } });
  if (existing) return existing;

  return prisma.merchant.create({
    data: {
      name,
      connector,
      status: MerchantStatus.CONNECTED,
    },
  });
}

async function createRiderUser(
  phone: string,
  name: string,
  bikeReg: string
) {
  const existingUser = await prisma.user.findUnique({ where: { phone } });
  if (existingUser) {
    const rider = await prisma.rider.findUnique({
      where: { userId: existingUser.id },
    });
    return { user: existingUser, rider };
  }

  const user = await prisma.user.create({
    data: {
      name,
      phone,
      passwordHash: await bcrypt.hash("123456", 10),
      role: UserRole.RIDER,
    },
  });

  const rider = await prisma.rider.create({
    data: {
      userId: user.id,
      name,
      phone,
      bikeReg,
      status: RiderStatus.AVAILABLE,
    },
  });

  return { user, rider };
}

async function main() {
  console.log("🌱 Seeding database...");

  await createAdmin();
  console.log("✅ Admin ready (0700000000 / password123)");

  const carrefour = await createMerchant("Carrefour", ConnectorType.CSV);
  const naivas = await createMerchant("Naivas", ConnectorType.CSV);
  const zuch = await createMerchant("Zuchinni", ConnectorType.API);

  const { rider: rider1 } = await createRiderUser(
    "0712345678",
    "James Kariuki",
    "KMCG 123A"
  );
  const { rider: rider2 } = await createRiderUser(
    "0720456789",
    "Peter Mwangi",
    "KMDU 456B"
  );

  console.log("✅ Riders ready (0712345678 / 0720456789 — password: 123456)");

  await prisma.order.createMany({
    data: [
      {
        merchantId: carrefour.id,
        customerName: "John Kamau",
        phone: "0711000001",
        address: "Garden Estate, Thika Rd",
        amount: 1250,
        paymentType: PaymentType.COD,
        status: OrderStatus.NEW,
      },
      {
        merchantId: naivas.id,
        customerName: "Mary Wanjiku",
        phone: "0711000002",
        address: "Roysambu",
        amount: 850,
        paymentType: PaymentType.COD,
        status: OrderStatus.NEW,
      },
      {
        merchantId: zuch.id,
        customerName: "Peter Otieno",
        phone: "0711000003",
        address: "Kilimani",
        amount: 2450,
        paymentType: PaymentType.PREPAID,
        status: OrderStatus.ASSIGNED,
        riderId: rider1.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log("🎉 Seeding complete");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
