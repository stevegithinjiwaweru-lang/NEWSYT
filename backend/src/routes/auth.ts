import express from "express";
import { prisma } from "../prisma";
import bcrypt from "bcrypt";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { add } from "date-fns";
import authMiddleware, { AuthRequest } from "../middlewares/auth";

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "auth",
    endpoints: [
      "POST /auth/register",
      "POST /auth/login",
      "POST /auth/refresh",
      "POST /auth/logout",
      "GET /auth/me",
    ],
  });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { rider: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        riderId: user.rider?.id ?? null,
      },
    });
  } catch (error) {
    console.error("Me error:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, phone, password, role } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: "phone and password required" });
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name || phone,
        phone,
        passwordHash,
        role: role || "DISPATCHER",
      },
    });

    return res.status(201).json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Failed to register user" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: "phone and password required" });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { rider: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
    });

    const refreshToken = signRefreshToken({ sub: user.id });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: add(new Date(), { days: 7 }),
      },
    });

    return res.json({
      ok: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        riderId: user.rider?.id ?? null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Failed to login" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken required" });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const payload = verifyRefreshToken(refreshToken) as { sub: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    const accessToken = signAccessToken({
      sub: payload.sub,
      role: user?.role,
    });

    return res.json({ ok: true, accessToken });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to logout" });
  }
});

export default router;
