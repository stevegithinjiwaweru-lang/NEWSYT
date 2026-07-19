import { prisma } from "../../prisma";
import * as repo from "./repository";
import bcrypt from "bcrypt";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import { add } from "date-fns";
import { logger } from "../../logger";
import { AuditWriter } from "../../utils/audit";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);

export interface CustomersServiceDeps {
  repo: typeof repo;
  audit: AuditWriter;
}

export class CustomersService {
  repo: typeof repo;
  audit: AuditWriter;

  constructor(deps: CustomersServiceDeps) {
    this.repo = deps.repo;
    this.audit = deps.audit;
  }

  async register(payload: { email: string; password: string; firstName?: string; lastName?: string; phone?: string }, ctx: { ip?: string; requestId?: string }) {
    const normalizedEmail = payload.email.toLowerCase().trim();

    return prisma.$transaction(async (tx) => {
      // check duplicate using tx
      const existing = await tx.customer.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        const err: any = new Error("Customer already exists");
        err.code = "PRESENT";
        throw err;
      }

      const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);

      const customer = await tx.customer.create({
        data: {
          email: normalizedEmail,
          phone: payload.phone,
          passwordHash,
          firstName: payload.firstName,
          lastName: payload.lastName,
          isActive: true,
        },
      });

      // create default wallet
      await tx.wallet.create({ data: { ownerType: "CUSTOMER", ownerId: customer.id, balance: 0 } });

      // create refresh token
      const refreshToken = signRefreshToken({ sub: customer.id });
      await tx.refreshToken.create({ data: { token: refreshToken, customerId: customer.id, expiresAt: add(new Date(), { days: REFRESH_TTL_DAYS }) } });

      // audit
      await tx.auditLog.create({ data: { actorId: customer.id, action: "customer.register", resource: "customer", resourceId: customer.id, newValue: { email: customer.email, firstName: customer.firstName, lastName: customer.lastName }, ip: ctx.ip, requestId: ctx.requestId } });

      logger.info("customer.register", { customerId: customer.id, requestId: ctx.requestId, ip: ctx.ip });

      const accessToken = signAccessToken({ sub: customer.id, role: "CUSTOMER" });

      return { customer: { id: customer.id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone }, accessToken, refreshToken };
    });
  }

  async login(payload: { email: string; password: string }, ctx: { ip?: string; requestId?: string }) {
    const normalizedEmail = payload.email.toLowerCase().trim();

    // find customer
    const customer = await this.repo.findCustomerByEmail(normalizedEmail);
    // generic error
    if (!customer || !customer.passwordHash || !customer.isActive) {
      const e: any = new Error("Invalid credentials");
      e.code = "AUTH";
      throw e;
    }

    const valid = await bcrypt.compare(payload.password, customer.passwordHash);
    if (!valid) {
      const e: any = new Error("Invalid credentials");
      e.code = "AUTH";
      throw e;
    }

    // rotate refresh token and update lastLogin in a transaction
    return prisma.$transaction(async (tx) => {
      // delete existing refresh tokens for this customer (we can choose policy to delete all)
      await tx.refreshToken.deleteMany({ where: { customerId: customer.id } });

      const refreshToken = signRefreshToken({ sub: customer.id });
      await tx.refreshToken.create({ data: { token: refreshToken, customerId: customer.id, expiresAt: add(new Date(), { days: REFRESH_TTL_DAYS }) } });

      await tx.customer.update({ where: { id: customer.id }, data: { lastLogin: new Date() } });

      await tx.auditLog.create({ data: { actorId: customer.id, action: "customer.login", resource: "customer", resourceId: customer.id, ip: ctx.ip, requestId: ctx.requestId } });

      logger.info("customer.login", { customerId: customer.id, requestId: ctx.requestId, ip: ctx.ip });

      const accessToken = signAccessToken({ sub: customer.id, role: "CUSTOMER" });
      return { accessToken, refreshToken, customer: { id: customer.id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone } };
    });
  }

  async refresh(oldRefreshToken: string, ctx: { ip?: string; requestId?: string }) {
    const stored = await this.repo.findRefreshToken(oldRefreshToken);
    if (!stored || !stored.customerId) {
      const e: any = new Error("Invalid refresh token");
      e.code = "AUTH";
      throw e;
    }

    try {
      const payload = verifyRefreshToken(oldRefreshToken) as { sub: string };
      const customerId = payload.sub;

      return prisma.$transaction(async (tx) => {
        await tx.refreshToken.deleteMany({ where: { token: oldRefreshToken } });
        const newRefresh = signRefreshToken({ sub: customerId });
        await tx.refreshToken.create({ data: { token: newRefresh, customerId, expiresAt: add(new Date(), { days: REFRESH_TTL_DAYS }) } });
        await tx.auditLog.create({ data: { actorId: customerId, action: "customer.refresh", resource: "customer", resourceId: customerId, ip: ctx.ip, requestId: ctx.requestId } });
        logger.info("customer.refresh", { customerId, requestId: ctx.requestId, ip: ctx.ip });
        const accessToken = signAccessToken({ sub: customerId, role: "CUSTOMER" });
        return { accessToken, refreshToken: newRefresh };
      });
    } catch (err) {
      logger.error("refresh verify failed", err);
      const e: any = new Error("Invalid refresh token");
      e.code = "AUTH";
      throw e;
    }
  }

  async logout(refreshToken?: string, actorId?: string | null, ctx?: { ip?: string; requestId?: string }) {
    return prisma.$transaction(async (tx) => {
      if (refreshToken) {
        await tx.refreshToken.deleteMany({ where: { token: refreshToken } });
      }
      await tx.auditLog.create({ data: { actorId: actorId || null, action: "customer.logout", resource: "customer", resourceId: actorId || null, ip: ctx?.ip, requestId: ctx?.requestId } });
      logger.info("customer.logout", { customerId: actorId, requestId: ctx?.requestId, ip: ctx?.ip });
      return { ok: true };
    });
  }

  async getProfile(actorId: string) {
    const customer = await this.repo.findCustomerById(actorId);
    if (!customer || !customer.isActive) {
      const e: any = new Error("Not found");
      e.code = "NOT_FOUND";
      throw e;
    }
    return { id: customer.id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone };
  }

  async updateProfile(actorId: string, data: { firstName?: string; lastName?: string; phone?: string }, ctx: { ip?: string; requestId?: string }) {
    const prev = await this.repo.findCustomerById(actorId);
    if (!prev || !prev.isActive) {
      const e: any = new Error("Not found");
      e.code = "NOT_FOUND";
      throw e;
    }

    const updated = await this.repo.updateCustomer(actorId, data as any);
    await this.audit.create({ actorId, action: "customer.update", resource: "customer", resourceId: actorId, prevValue: { firstName: prev.firstName, lastName: prev.lastName, phone: prev.phone }, newValue: { firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone }, ip: ctx.ip, requestId: ctx.requestId } as any).catch((err) => logger.error("audit create failed", err));

    return { id: updated.id, email: updated.email, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone };
  }
}

// default service instance using the real repo and a simple audit writer will be created later by the app startup code
export default CustomersService;
