import { prisma } from "../../prisma";
import { logger } from "../../logger";

export interface AuditEvent {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  prevValue?: any;
  newValue?: any;
  ip?: string | null;
  requestId?: string | null;
}

export interface AuditWriter {
  create(event: AuditEvent): Promise<void>;
}

export const createAuditWriter = (): AuditWriter => {
  return {
    async create(event: AuditEvent) {
      try {
        await prisma.auditLog.create({
          data: {
            actorId: event.actorId || null,
            action: event.action,
            resource: event.resource,
            resourceId: event.resourceId || null,
            prevValue: event.prevValue ? event.prevValue : undefined,
            newValue: event.newValue ? event.newValue : undefined,
            ip: event.ip || null,
            requestId: event.requestId || null,
          },
        });

        logger.info("audit.created", { event });
      } catch (err) {
        // If audit persist fails, log error but do not fail main flow
        logger.error("audit.create.failed", { err, event });
      }
    },
  };
};
