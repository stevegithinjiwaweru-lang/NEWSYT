import express from "express";
import { prisma } from "../prisma";
import authMiddleware, { AuthRequest } from "../middlewares/auth";
import { io } from "../app";
import { OrderStatus, RiderStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const router = express.Router();
const requireAuth = authMiddleware;

// =====================
// LIST RIDERS
// =====================
router.get("/", requireAuth, async (_req, res) => {
  try {
    const riders = await prisma.rider.findMany({
      orderBy: { name: "asc" },
      include: { user: true },
    });

    return res.json({
      ok: true,
      count: riders.length,
      riders,
    });
  } catch (error) {
    console.error("List riders error:", error);

    return res.status(500).json({
      ok: false,
      error: "Failed to fetch riders",
    });
  }
});

// Helper: generate a short temporary password
function generateTempPassword(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let pwd = "";
  for (let i = 0; i < length; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  return pwd;
}

// =====================
// CREATE RIDER
// Creates a linked User (role=RIDER) if one does not exist for the phone.
// Returns tempPassword in response when a new user is created (so admin can share credentials).
// =====================
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, phone, bikeReg, branch, password } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ ok: false, error: "name and phone are required" });
    }

    // Check if a rider already exists with this phone (either as rider.phone or user.phone)
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    const existingRiderByPhone = await prisma.rider.findFirst({ where: { phone } });

    if (existingRiderByPhone) {
      return res.status(400).json({ ok: false, error: "A rider with this phone already exists" });
    }

    let userId: string | undefined;
    let tempPassword: string | undefined;

    if (existingUser) {
      // If user exists but already linked to a rider, reject
      const linkedRider = await prisma.rider.findUnique({ where: { userId: existingUser.id } });
      if (linkedRider) {
        return res.status(400).json({ ok: false, error: "A rider account is already linked to this user" });
      }
      userId = existingUser.id;
    } else {
      // Create a new user for the rider
      tempPassword = password || generateTempPassword(10);
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const user = await prisma.user.create({
        data: {
          name,
          phone,
          passwordHash,
          role: "RIDER",
        },
      });
      userId = user.id;
    }

    // Create the Rider record and link to userId
    const rider = await prisma.rider.create({
      data: {
        name,
        phone,
        bikeReg,
        branch,
        status: RiderStatus.AVAILABLE,
        userId,
      },
    });

    return res.status(201).json({ ok: true, rider, tempPassword });
  } catch (error: any) {
    console.error("Create rider error:", error);

    // Handle unique constraint errors
    if (error.code === "P2002") {
      return res.status(400).json({ ok: false, error: "Phone number already in use" });
    }

    return res.status(500).json({ ok: false, error: "Failed to create rider" });
  }
});

// =====================
// UPDATE RIDER
// =====================
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.rider.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Rider not found" });
    }

    const rider = await prisma.rider.update({
      where: { id },
      data: req.body,
    });

    return res.json({ ok: true, rider });
  } catch (error) {
    console.error("Update rider error:", error);

    return res.status(500).json({ ok: false, error: "Failed to update rider" });
  }
});

// =====================
// DELETE RIDER
// Note: we do NOT delete the linked User automatically to avoid accidental data loss.
// =====================
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.rider.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Rider not found" });
    }

    await prisma.rider.delete({ where: { id } });

    return res.json({ ok: true, message: "Rider deleted successfully" });
  } catch (error) {
    console.error("Delete rider error:", error);

    return res.status(500).json({ ok: false, error: "Failed to delete rider" });
  }
});

// =====================
// LIVE LOCATION ENGINE
// =====================
router.post("/:id/location", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, bearing, speed, timestamp } = req.body;

    if (lat == null || lng == null) {
      return res.status(400).json({ ok: false, error: "lat and lng are required" });
    }

    const rider = await prisma.rider.findUnique({ where: { id }, include: { user: true } });

    if (!rider) {
      return res.status(404).json({ ok: false, error: "Rider not found" });
    }

    if (rider.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const updated = await prisma.rider.update({
      where: { id },
      data: {
        lastLat: Number(lat),
        lastLng: Number(lng),
        lastSeenAt: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    const payload = {
      riderId: updated.id,
      lat: updated.lastLat,
      lng: updated.lastLng,
      bearing: bearing ?? null,
      speed: speed ?? null,
      timestamp: updated.lastSeenAt,
    };

    io.to("dashboard").emit("rider:location:update", payload);

    const activeOrders = await prisma.order.findMany({
      where: {
        riderId: updated.id,
        status: { in: [OrderStatus.ASSIGNED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] },
      },
    });

    for (const order of activeOrders) {
      io.to("dashboard").emit("order:tracking:update", {
        orderId: order.id,
        riderId: updated.id,
        lat: updated.lastLat,
        lng: updated.lastLng,
        status: order.status,
      });
    }

    return res.json({ ok: true, rider: updated });
  } catch (error) {
    console.error("Location update error:", error);
    return res.status(500).json({ ok: false, error: "Failed to update rider location" });
  }
});

export default router;
