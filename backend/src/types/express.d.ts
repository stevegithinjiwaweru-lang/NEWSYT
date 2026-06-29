import { Merchant } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      merchant?: Merchant;
      idempotency?: {
        key: string;
        requestHash: string;
      };
    }
  }
}

export {};
