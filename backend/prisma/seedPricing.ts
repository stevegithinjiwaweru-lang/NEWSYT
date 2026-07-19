import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPricing() {
  console.log("Seeding default pricing rules...");

  const rules = [
    {
      name: "Motorcycle",
      baseFare: 100,
      perKm: 25,
      perMinute: 2,
      vehicleType: "MOTORCYCLE",
      packageSize: null,
      isSurgeActive: true,
      multiplier: 1.0,
      conditions: {
        minimumFare: 50,
        maxServiceRadiusKm: 20,
        freeWaitingTimeSec: 120, // 2 minutes
        surge: {
          thresholds: [
            { demandRatio: 1.2, multiplier: 1.25 },
            { demandRatio: 1.5, multiplier: 1.5 }
          ],
        },
        nightPricing: { startHour: 22, endHour: 5, multiplier: 1.2 },
        holidayMultiplier: 1.5
      }
    },
    {
      name: "Tuk Tuk",
      baseFare: 150,
      perKm: 35,
      perMinute: 3,
      vehicleType: "TUKTUK",
      packageSize: null,
      isSurgeActive: true,
      multiplier: 1.0,
      conditions: {
        minimumFare: 80,
        maxServiceRadiusKm: 25,
        freeWaitingTimeSec: 120,
        surge: {
          thresholds: [
            { demandRatio: 1.2, multiplier: 1.25 },
            { demandRatio: 1.5, multiplier: 1.6 }
          ]
        },
        nightPricing: { startHour: 22, endHour: 5, multiplier: 1.25 },
        holidayMultiplier: 1.6
      }
    },
    {
      name: "Pickup",
      baseFare: 300,
      perKm: 60,
      perMinute: 5,
      vehicleType: "PICKUP",
      packageSize: null,
      isSurgeActive: true,
      multiplier: 1.0,
      conditions: {
        minimumFare: 150,
        maxServiceRadiusKm: 80,
        freeWaitingTimeSec: 180,
        surge: {
          thresholds: [
            { demandRatio: 1.2, multiplier: 1.2 },
            { demandRatio: 1.5, multiplier: 1.4 }
          ]
        },
        nightPricing: { startHour: 22, endHour: 5, multiplier: 1.2 },
        holidayMultiplier: 1.4
      }
    },
    {
      name: "Van",
      baseFare: 500,
      perKm: 80,
      perMinute: 6,
      vehicleType: "VAN",
      packageSize: null,
      isSurgeActive: true,
      multiplier: 1.0,
      conditions: {
        minimumFare: 250,
        maxServiceRadiusKm: 120,
        freeWaitingTimeSec: 300,
        surge: {
          thresholds: [
            { demandRatio: 1.2, multiplier: 1.15 },
            { demandRatio: 1.5, multiplier: 1.3 }
          ]
        },
        nightPricing: { startHour: 22, endHour: 5, multiplier: 1.25 },
        holidayMultiplier: 1.5
      }
    }
  ];

  for (const rule of rules) {
    await prisma.pricingRule.upsert({
      where: { name: rule.name },
      update: {
        baseFare: rule.baseFare,
        perKm: rule.perKm,
        perMinute: rule.perMinute,
        vehicleType: rule.vehicleType,
        isSurgeActive: rule.isSurgeActive,
        multiplier: rule.multiplier,
        conditions: rule.conditions,
        updatedAt: new Date(),
      },
      create: {
        name: rule.name,
        baseFare: rule.baseFare,
        perKm: rule.perKm,
        perMinute: rule.perMinute,
        vehicleType: rule.vehicleType,
        packageSize: rule.packageSize,
        isSurgeActive: rule.isSurgeActive,
        multiplier: rule.multiplier,
        conditions: rule.conditions,
      },
    });
    console.log(`Seeded pricing rule: ${rule.name}`);
  }

  console.log("Pricing seed complete.");
}

seedPricing()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
