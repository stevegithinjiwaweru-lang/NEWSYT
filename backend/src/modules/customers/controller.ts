import { Request, Response } from "express";
import { prisma } from "../../prisma";
import bcrypt from "bcrypt";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { add } from "date-fns";
import { logger } from "../../logger";
import { createAudit } from "../../utils/audit";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

export async function registerCustomer(req: Request, res: Response) {
  try {
    const { email, phone, password, firstName, lastName } = req.body;

    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const existing = await prisma.customer.findFirst({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res.status(409).json({ error: "Customer already exists" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const customer = await prisma.customer.create({
      data: {
        email: normalizedEmail,
        phone,
        passwordHash,
        firstName,
        lastName,
      },
    });

    await createAudit({
      actorId: customer.id,
      action: "customer.register",
      resource: "customer",
      resourceId: customer.id,
      newValue: { email: customer.email, firstName: customer.firstName, lastName: customer.lastName },
      ip: req.ip,
      requestId: (req as any).requestId,
    });

    return res.status(201).json({ ok: true, customer: { id: customer.id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName } });
  } catch (err) {
    logger.error("registerCustomer error", err);
    return res.status(500).json({ error: "Failed to register customer" });
  }
}

export async function loginCustomer(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const customer = await prisma.customer.findUnique({ where: { email: normalizedEmail } });

    // Always respond with generic error to avoid user enumeration
    if (!customer || !customer.isActive || !customer.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = signAccessToken({ sub: customer.id, role: "CUSTOMER" });
    const refreshToken = signRefreshToken({ sub: customer.id });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        customerId: customer.id,
        expiresAt: add(new Date(), { days: 7 }),
      },
    });

    await createAudit({
      actorId: customer.id,
      action: "customer.login",
      resource: "customer",
      resourceId: customer.id,
      ip: req.ip,
      requestId: (req as any).requestId,
    });

    return res.json({ ok: true, accessToken, refreshToken, customer: { id: customer.id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName } });
  } catch (err) {
    logger.error("loginCustomer error", err);
    return res.status(500).json({ error: "Failed to login" });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });

    const storedToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!storedToken || !storedToken.customerId) return res.status(401).json({ error: "Invalid refresh token" });

    try {
      const payload = verifyRefreshToken(refreshToken) as { sub: string };
      const customerId = payload.sub;

      // rotate
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
      const newRefresh = signRefreshToken({ sub: customerId });
      await prisma.refreshToken.create({ data: { token: newRefresh, customerId, expiresAt: add(new Date(), { days: 7 }) } });

      const accessToken = signAccessToken({ sub: customerId, role: "CUSTOMER" });

      await createAudit({
        actorId: customerId,
        action: "customer.refresh",
        resource: "customer",
        resourceId: customerId,
        ip: req.ip,
        requestId: (req as any).requestId,
      });

      return res.json({ ok: true, accessToken, refreshToken: newRefresh });
    } catch (err) {
      logger.error("Customer refresh token verification failed", err);
      return res.status(401).json({ error: "Invalid refresh token" });
    }
  } catch (err) {
    logger.error("refreshToken error", err);
    return res.status(500).json({ error: "Failed to refresh token" });
  }
}

export async function logoutCustomer(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }

    await createAudit({
      actorId: (req as any).user?.id || null,
      action: "customer.logout",
      resource: "customer",
      resourceId: (req as any).user?.id || null,
      ip: req.ip,
      requestId: (req as any).requestId,
    });

    return res.json({ ok: true });
  } catch (err) {
    logger.error("logoutCustomer error", err);
    return res.status(500).json({ error: "Failed to logout" });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const auth = (req as any).user;
    if (!auth || !auth.id) return res.status(401).json({ error: "Unauthorized" });

    const customer = await prisma.customer.findUnique({ where: { id: auth.id } });
    if (!customer || !customer.isActive) return res.status(404).json({ error: "Customer not found" });

    return res.json({ ok: true, customer: { id: customer.id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone } });
  } catch (err) {
    logger.error("getMe error", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
}

export async function updateMe(req: Request, res: Response) {
  try {
    const auth = (req as any).user;
    if (!auth || !auth.id) return res.status(401).json({ error: "Unauthorized" });

    const { firstName, lastName, phone } = req.body;

    const prev = await prisma.customer.findUnique({ where: { id: auth.id } });
    if (!prev || !prev.isActive) return res.status(404).json({ error: "Customer not found" });

    const updated = await prisma.customer.update({ where: { id: auth.id }, data: { firstName, lastName, phone } });

    await createAudit({
      actorId: auth.id,
      action: "customer.update",
      resource: "customer",
      resourceId: auth.id,
      prevValue: { firstName: prev.firstName, lastName: prev.lastName, phone: prev.phone },
      newValue: { firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone },
      ip: req.ip,
      requestId: (req as any).requestId,
    });

    return res.json({ ok: true, customer: { id: updated.id, email: updated.email, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone } });
  } catch (err) {
    logger.error("updateMe error", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}
