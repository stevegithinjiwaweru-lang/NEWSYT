// Augments Express's Request type with the raw request body captured for
// webhook signature verification (see app.ts's /webhooks raw-body middleware).
declare namespace Express {
  interface Request {
    rawBody?: string;
  }
}
