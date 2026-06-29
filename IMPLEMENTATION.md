# Easybox External API — Phased Implementation

This document captures the plan for extending NEWSYT's existing backend into a
provider for external integration clients (starting with **Easybox-zucchini /
Gumza**, the WhatsApp ordering layer). It complements `README.md`, which covers
the current internal-only API.

> **Reading this for the first time?** Start with [Architecture](#architecture)
> and [Foundations](#foundations--built-alongside-phase-1). Each phase below
> can be implemented in order; nothing in a later phase blocks an earlier one
> from shipping.

## Status

| Phase | Status |
|---|---|
| Phase 1 — Dispatch + status webhooks | ✅ Implemented |
| Phase 2 — Live GPS tracking | ✅ Implemented |
| Phase 3 — Quotes / fees / zones | ✅ Implemented |
| Phase 4 — POD payment + cancellations | ✅ Implemented |
| Admin onboarding endpoints (API key + webhook config) | ✅ Implemented |
| **Gumza integration** (contract bend on both sides) | ✅ Code complete |
| **End-to-end smoke test** | ⏳ Pending — see [Pending: deployment + smoke test](#pending-deployment--smoke-test) |

---

## Architecture

Two API surfaces will live side-by-side in the same Express app:

| Surface | Routes | Auth | Consumers |
|---|---|---|---|
| **Internal** (existing) | `/auth`, `/orders`, `/riders`, `/merchants` | JWT bearer (user) | Dispatch dashboard, rider mobile app |
| **External** (new) | `/api/v1/external/*` | API key + HMAC-signed webhooks | Integration clients (Gumza, future) |

The existing internal API stays untouched. New code lives under
`src/modules/external/` and shares the existing Prisma client, Redis
connection, BullMQ queues, and Socket.IO instance.

**Tenancy model.** Each integration client is modelled as an existing
`Merchant` row. The client's API key hash and outbound webhook URL/secret live
in `Merchant.config` (JSON). Riders, zones, and dispatch logic are shared
across clients — there is no per-client data isolation beyond filtering
dispatch ownership by `merchantId`.

```
                                ┌──────────────────────────────┐
 Easybox-zucchini ─── HTTPS ──► │  /api/v1/external/...        │
 (or other client)              │  (API key + zod + idempotency)│
                                └────────────┬─────────────────┘
                                             │
                                             ▼
                              ┌────────────────────────────┐
                              │     dispatchEventsService   │
                              │  publish(merchantId, event) │
                              └─┬───────────┬───────────────┘
                                │           │
                                ▼           ▼
                           BullMQ        Socket.IO
                       webhook-delivery   (dashboard)
                                │
                                ▼
                          POST {client webhook}
                          X-Easybox-Signature: sha256=<hex>
                          X-Easybox-Timestamp: <unix>
```

---

## Foundations — built alongside Phase 1

These are not a separate sprint; they ship as part of Phase 1, but they apply
to every phase that follows. They also close the highest-priority gaps against
the org-wide standards in `../CLAUDE.md` for the new API surface only.

### Versioning

All new routes mount under `/api/v1/external/...`. Existing internal routes
stay at their current paths.

### Environment validation

New `src/config/env.ts` validates required env vars at boot with zod. Fails
fast on missing values. Replaces the hardcoded `"test_access_secret"` /
`"test_refresh_secret"` fallbacks in `utils/jwt.ts` and `middlewares/auth.ts`.

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  API_KEY_PEPPER: z.string().min(32),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().default(10),
});
export const env = envSchema.parse(process.env);
```

### API-key auth

New middleware `apiKeyAuth.ts`:
1. Read `X-API-Key: <key_id>.<secret>` header.
2. Look up `Merchant` by `config.apiKeyId`.
3. `bcrypt.compare(secret + env.API_KEY_PEPPER, merchant.config.apiKeyHash)`.
4. On match, set `req.merchant = merchant` and continue.
5. On any failure, return `401 UNAUTHORIZED` (don't leak which step failed).

Keys are issued via an internal admin endpoint and shown to the operator
exactly once. Rotation: issue a new key, mark the old one for deletion after
a grace period.

### Validation, errors, response envelope

- **zod** on every external endpoint body / query / params.
- Typed `AppError` hierarchy in `src/shared/errors/`:
  `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`,
  `ConflictError`, `RateLimitedError`.
- One error middleware mounted on the external router — maps `AppError` to the
  envelope below, logs with `requestId`, hides stack traces in production.
- New response envelope for external routes only:

```jsonc
// Success
{ "success": true, "data": { /* ... */ } }
// Error
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Dispatch not found", "details": null } }
```

The existing internal routes keep their `{ ok, error }` shape — we will not
rewrite them in this initiative.

### Security middleware

- `helmet()` on the Express app root.
- `express-rate-limit` (Redis-backed via existing `ioredis`) mounted on
  `/api/v1/external/*` — default 60 req/min per API key, tighter per-endpoint
  limits where noted.
- `express.json({ limit: '100kb' })` (already set in `app.ts` — confirm and
  keep).
- CORS for the external API: server-to-server, no browser origins.
  `cors({ origin: false })` on the external router.

### Idempotency

New `IdempotencyKey` table. Every mutating external endpoint requires an
`Idempotency-Key` header.

```prisma
model IdempotencyKey {
  id           String   @id @default(cuid())
  merchantId   String
  key          String
  requestHash  String   // SHA-256 of method + path + body
  responseBody Json
  statusCode   Int
  createdAt    DateTime @default(now())

  @@unique([merchantId, key])
  @@index([createdAt]) // for TTL cleanup
}
```

- First request with a given `(merchantId, key)` is processed normally; the
  response is stored.
- Subsequent requests with the same key and matching `requestHash` return the
  stored response verbatim (same status code, same body).
- Same key with **different** body → `409 IDEMPOTENCY_KEY_REUSED`.
- 24-hour TTL, swept by a BullMQ repeat job.

### Logging

- `pino` instance in `src/shared/logger.ts` — JSON output in production.
- `requestId` middleware generates a UUID per request, sets
  `X-Request-Id` response header, attaches to the request, propagates into all
  log lines for that request.
- **Never log**: `passwordHash`, JWT tokens, API keys, request bodies that may
  contain customer PII (sanitize via pino redact paths).

### Outbound webhook delivery

- New BullMQ queue: `webhook-delivery`.
- New worker `src/modules/external/webhooks/delivery.worker.ts`.
- Each enqueued job: `{ merchantId, event, payload, attemptCount }`.
- Worker POSTs to `merchant.config.webhookUrl` with:
  - `Content-Type: application/json`
  - `X-Easybox-Event: dispatch.assigned`
  - `X-Easybox-Signature: t=<unix-seconds>,v1=<hex-hmac-sha256(t + '.' + body, merchant.config.webhookSecret)>`
- Retry policy: `attempts: env.WEBHOOK_MAX_ATTEMPTS` (default 10),
  `backoff: { type: 'exponential', delay: 5000 }`. Roughly 24h coverage.
- Every attempt logged to a new `OutboundWebhook` table for inspection / replay.

```prisma
enum WebhookDeliveryStatus { PENDING SUCCESS FAILED }

model OutboundWebhook {
  id          String                  @id @default(cuid())
  merchantId  String
  event       String
  payload     Json
  status      WebhookDeliveryStatus   @default(PENDING)
  attempts    Int                     @default(0)
  lastError   String?
  deliveredAt DateTime?
  createdAt   DateTime                @default(now())

  @@index([merchantId, createdAt])
  @@index([status, attempts])
}
```

### Domain event publisher

A single shared service the rest of the codebase calls instead of enqueueing
webhook jobs directly. Both the internal REST routes and the Socket.IO
handlers route through this so events fire exactly once per state change.

```ts
// src/modules/external/webhooks/publisher.ts
export async function publishDispatchEvent(
  merchantId: string,
  event: DispatchEvent,
  payload: object,
): Promise<void> {
  await webhookQueue.add(event, { merchantId, event, payload }, {
    attempts: env.WEBHOOK_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: false,
  });
}
```

### Testing

- **Unit**: HMAC signer/verifier, idempotency hasher, API-key auth, status
  mappers. No DB / Redis / network.
- **Integration**: Vitest + Supertest against a dedicated test database. A
  local HTTP listener stands in as the client webhook endpoint. Covers
  full flow: `POST /dispatches` → internal assign → `dispatch.assigned`
  delivered (HMAC-verified) → status updates → terminal state.
- **Coverage target**: 80% on services and repositories in
  `src/modules/external/` (matches `../CLAUDE.md §11`).

### Documentation deliverables

- `docs/external-api.md` — endpoint reference, webhook payload shapes, HMAC
  verification example in a few languages.
- A Postman collection covering every external endpoint (mirrors the existing
  `easybox-postman-collection.json` in the parent project).

---

## Phase 1 — Dispatch + status webhooks

**Goal:** unblock the parent project's hand-off path. Easybox-zucchini can
create a dispatch and receive status events without any human in the loop.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/external/dispatches` | Create a dispatch (=Order owned by the calling merchant). Requires `Idempotency-Key`. |
| `GET` | `/api/v1/external/dispatches/:id` | Current dispatch status, rider (if assigned), POD URL (if delivered), tracking URL. |
| `GET` | `/api/v1/external/dispatches?external_id=...` | Lookup by client's order ID (in case they don't store ours). |

#### `POST /api/v1/external/dispatches`

```jsonc
// Request
{
  "external_id": "GUMZA-ORD-1234",          // client's order key, must be unique per merchant
  "customer": { "name": "John Kamau", "phone": "+254711000001" },
  "drop_off": { "address": "Garden Estate, Thika Rd", "lat": -1.234, "lng": 36.876 },
  "pickup":   { "address": "Gumza Market, Eastleigh", "lat": -1.286, "lng": 36.852 },
  "amount":   1250,
  "currency": "KES",
  "payment_type": "COD",                    // or "PREPAID"
  "package_notes": "1 box, ~3kg",
  "items": [{ "sku": "TOM-1KG", "qty": 2 }] // optional, not used by routing
}

// 202 Accepted
{
  "success": true,
  "data": {
    "id": "dsp_ck9a8b...",
    "external_id": "GUMZA-ORD-1234",
    "status": "REQUESTED",
    "tracking_url": "https://track.easybox.example/dsp_ck9a8b...",
    "created_at": "2026-06-29T12:34:56.789Z"
  }
}
```

Idempotency key replay returns the stored response verbatim.

#### `GET /api/v1/external/dispatches/:id`

```jsonc
{
  "success": true,
  "data": {
    "id": "dsp_ck9a8b...",
    "external_id": "GUMZA-ORD-1234",
    "status": "EN_ROUTE",                   // see status table below
    "rider": { "name": "James K.", "phone": "+254712345678", "bike_reg": "KMCG 123A" },
    "eta_minutes": 18,
    "pod_url": null,
    "tracking_url": "https://track.easybox.example/dsp_ck9a8b...",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### Status mapping (external ↔ internal `OrderStatus`)

| External | Internal `OrderStatus` | Terminal? |
|---|---|---|
| `REQUESTED` | `NEW` | no |
| `ASSIGNED` | `ASSIGNED` | no |
| `COLLECTED` | `PICKED_UP` | no |
| `EN_ROUTE` | `IN_TRANSIT` | no |
| `DELIVERED` | `DELIVERED` | yes |
| `FAILED` | `FAILED` | yes |
| `CANCELLED` | (Phase 4: new internal status) | yes |

### Outbound webhook events

Endpoint: `POST {merchant.config.webhookUrl}` (a single URL per merchant). The
`X-Easybox-Event` header identifies which event:

| Event | Trigger site | Payload |
|---|---|---|
| `dispatch.assigned` | `PATCH /orders/:id/assign`, `order:assign` socket | `{ dispatch_id, external_id, rider, occurred_at }` |
| `dispatch.collected` | `PATCH /orders/:id/status` → `PICKED_UP` | `{ dispatch_id, external_id, occurred_at }` |
| `dispatch.en_route` | `PATCH /orders/:id/status` → `IN_TRANSIT` | `{ dispatch_id, external_id, occurred_at }` |
| `dispatch.delivered` | `PATCH /orders/:id/status` → `DELIVERED` or `POST /orders/:id/pod` | `{ dispatch_id, external_id, pod_url?, occurred_at }` |
| `dispatch.failed` | `PATCH /orders/:id/status` → `FAILED` | `{ dispatch_id, external_id, reason?, occurred_at }` |

All payloads also include `event` (string) and `id` (event UUID — clients dedupe
on this).

### Schema deltas (Phase 1 migration)

```prisma
model Order {
  // ... existing fields ...
  pickupAddress  String?
  pickupLat      Float?
  pickupLng      Float?
  packageNotes   String?
  etaMinutes     Int?

  @@unique([merchantId, externalId]) // make externalId unique per merchant
}

model Merchant {
  // ... existing fields ...
  // config JSON now expected to carry:
  //   { apiKeyId: string, apiKeyHash: string, webhookUrl: string, webhookSecret: string }
  // No schema change needed — documented contract.
}

model IdempotencyKey { /* see Foundations */ }
model OutboundWebhook { /* see Foundations */ }

// DROP the unused `Dispatch` model in this migration.
```

> **Note**: the existing `Order.externalId` has a global `@unique`. We need it
> unique **per merchant**, so the migration drops the existing unique
> constraint and adds `@@unique([merchantId, externalId])`.

### Touch points in existing code

- `src/routes/orders.ts`
  - `PATCH /:id/assign` — call `publishDispatchEvent(merchantId, 'dispatch.assigned', ...)` after the existing `io.to(...).emit(...)`.
  - `PATCH /:id/status` — branch on the new status; publish the matching event.
  - `POST /:id/pod` — publish `dispatch.delivered`.
- `src/socket.ts`
  - `order:assign` handler — publish `dispatch.assigned`.
  - `order:status` handler — publish the corresponding event.
- Both call sites must filter: only publish for orders whose `merchantId` has
  a `webhookUrl` configured (skip webhook for merchants that don't integrate).

### Phase 1 acceptance criteria

- [ ] An admin can issue an API key + webhook config to a merchant.
- [ ] A client `POST`s a dispatch and gets back a `dispatch_id` and `tracking_url`.
- [ ] Replaying the same `Idempotency-Key` returns the original response.
- [ ] Reusing the key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`.
- [ ] The dispatch appears in the existing dashboard and can be assigned to a rider.
- [ ] On assignment, a `dispatch.assigned` webhook arrives at the client URL with valid HMAC.
- [ ] Each subsequent status change fires the right webhook.
- [ ] Client webhook receiver going offline → BullMQ retries with exponential backoff; eventual delivery on recovery.
- [ ] Final-failure webhooks are visible in `OutboundWebhook` with `status=FAILED` and `lastError`.

---

## Phase 2 — Live GPS tracking

**Goal:** Easybox-zucchini's customer tracking page (or a tracking URL we
provide) can show the rider moving in real time.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/external/dispatches/:id/location` | Last known rider location for an active dispatch. |
| `GET` | `/api/v1/external/dispatches/:id/track-stream` | Server-sent events stream emitting location every ~3s. |

```jsonc
// GET /api/v1/external/dispatches/:id/location → 200
{
  "success": true,
  "data": {
    "dispatch_id": "dsp_ck9a8b...",
    "lat": -1.235, "lng": 36.875,
    "bearing": 124,
    "speed_kmh": 23,
    "last_seen_at": "2026-06-29T12:40:01.123Z"
  }
}
// → 409 if dispatch is in a terminal state (DELIVERED / FAILED / CANCELLED)
// → 425 NO_LOCATION_YET if no rider is assigned yet or no GPS sample has landed
```

### Implementation notes

- Existing `rider:location` socket handler already writes
  `Rider.lastLat/Lng/lastSeenAt`. Extend it to also `SET` a Redis key
  `rider:loc:<riderId>` (JSON value, TTL 30s) so the public endpoint can serve
  from cache without hitting Postgres on every poll.
- SSE handler subscribes to a Redis pubsub channel `rider:loc:<riderId>` and
  flushes one event per location update. Auto-closes when the dispatch reaches
  a terminal state.
- Tight rate limit: 10 req/s per dispatch, 60 req/min per API key.

### Schema deltas

None required for Phase 2. (Optional `RiderLocationHistory` deferred — only
add if a client asks for replay.)

### Phase 2 acceptance criteria

- [ ] During an active dispatch, polling the location endpoint returns the latest GPS sample within 1s of it landing from the rider app.
- [ ] SSE stream emits new positions every ~3s and closes cleanly on terminal status.
- [ ] Endpoint returns `425 NO_LOCATION_YET` before any sample exists, and `409 TERMINAL_STATE` after delivery.
- [ ] Rate limiter rejects abusive callers without affecting normal polling.

---

## Phase 3 — Quotes / fees / zones

**Goal:** clients can compute the delivery fee for a drop-off **before**
creating a dispatch, so they can show it to the customer at checkout. Also
exposes operating hours and zone coverage.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/external/quotes` | Returns fee + ETA + zone for a given pickup/drop-off. |
| `GET` | `/api/v1/external/zones` | Lists active delivery zones (id, name, base fee, operating hours). |

```jsonc
// POST /api/v1/external/quotes
// Request
{
  "pickup":   { "lat": -1.286, "lng": 36.852 },
  "drop_off": { "lat": -1.235, "lng": 36.875 },
  "items":    [{ "sku": "TOM-1KG", "qty": 2 }]   // optional, for weight-based pricing later
}

// 200
{
  "success": true,
  "data": {
    "fee": 200,
    "currency": "KES",
    "eta_minutes": 35,
    "zone_id": "zn_thika_rd",
    "operating_hours": { "open": "08:00", "close": "20:00", "tz": "Africa/Nairobi" },
    "accepts_now": true,
    "expires_at": "2026-06-29T12:55:00.000Z"
  }
}

// 422 OUT_OF_COVERAGE if drop-off is outside all active zones.
```

### Schema deltas

```prisma
model Zone {
  id              String   @id @default(cuid())
  name            String
  polygonGeoJson  Json     // GeoJSON Polygon
  baseFee         Float
  perKmFee        Float?
  operatingHours  Json     // { open, close, tz }
  dailyCutoff     String?  // "HH:mm" — after this, accepts_now=false
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Implementation notes

- Point-in-polygon via `@turf/boolean-point-in-polygon`. No PostGIS dependency
  — we can promote to PostGIS later if zone count or query volume demand it.
- Internal admin endpoints to CRUD zones live under the existing JWT-protected
  internal API, not the external one. UI is out of scope for this plan.
- Quotes are advisory — Phase 1 dispatches don't yet reference a `quote_id`.
  A future iteration can require a quote token to lock the fee for ~15
  minutes; defer until pricing is contested.

### Phase 3 acceptance criteria

- [ ] Admin can create a zone via the internal API and see it returned in `GET /zones`.
- [ ] A quote for a point inside a zone returns the right fee and ETA.
- [ ] A quote for a point outside all zones returns `422 OUT_OF_COVERAGE`.
- [ ] After `dailyCutoff`, `accepts_now` is `false`.

---

## Phase 4 — POD payment confirmation + cancellations

**Goal:** close the loop on cash-on-delivery (clients learn whether the rider
actually collected payment) and allow the client to cancel a dispatch before
or during delivery.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/external/dispatches/:id/cancel` | Cancel a dispatch. Conditional on current status. |
| `POST` | `/orders/:id/payment` (**internal**, rider app) | Rider records POD payment outcome. |

#### Cancel — behavior by current status

| Current status | Behavior |
|---|---|
| `REQUESTED`, `ASSIGNED` | Cancel free, free the rider, emit `dispatch.cancelled`. |
| `COLLECTED`, `EN_ROUTE` | Return `409 CANCEL_REQUIRES_FEE` with `{ cancellation_fee, currency }` in details. Caller must retry with `?confirm_fee=true` to proceed. |
| `DELIVERED`, `FAILED`, `CANCELLED` | `409 TERMINAL_STATE`. |

#### Rider POD payment (internal, but feeds an external webhook)

```jsonc
// POST /orders/:id/payment  (rider app, JWT auth, riderOnly)
{
  "method": "MPESA",        // CASH | MPESA | CARD
  "amount": 1250,
  "reference": "QGH7K2M9X8" // optional — M-Pesa code, terminal txn id, etc.
}
```

On success, emits a `dispatch.payment_collected` webhook to the merchant.

### New webhook events

| Event | Trigger | Payload |
|---|---|---|
| `dispatch.payment_collected` | `POST /orders/:id/payment` succeeds | `{ dispatch_id, method, amount, reference?, occurred_at }` |
| `dispatch.cancelled` | `POST /dispatches/:id/cancel` succeeds | `{ dispatch_id, cancellation_fee?, reason, cancelled_by, occurred_at }` |

### Schema deltas

```prisma
enum PaymentStatus { PENDING COLLECTED FAILED NOT_REQUIRED }
enum PaymentMethod { CASH MPESA CARD }

model Order {
  // ... existing fields ...
  paymentStatus   PaymentStatus  @default(NOT_REQUIRED) // set to PENDING for COD on create
  paymentMethod   PaymentMethod?
  amountCollected Float?
  paymentRef      String?
  paidAt          DateTime?

  cancelledAt     DateTime?
  cancelReason    String?
  cancelFee       Float?
}

// Add to OrderStatus enum: CANCELLED
```

### Phase 4 acceptance criteria

- [ ] Rider records a POD payment via the mobile app; `dispatch.payment_collected` arrives at the client.
- [ ] Client can cancel a `REQUESTED` dispatch and rider is freed.
- [ ] Cancelling an `EN_ROUTE` dispatch without `confirm_fee=true` returns `409` with the fee.
- [ ] Cancelling with `confirm_fee=true` succeeds and fires `dispatch.cancelled`.
- [ ] Cancelling a `DELIVERED` dispatch returns `409 TERMINAL_STATE`.

---

## Open questions to resolve before Phase 1 ships

These need product / ops input — not blockers for design, but each one shapes
a default we'd otherwise pick arbitrarily.

1. **Webhook retry SLA.** Default: ~24h total, exponential backoff, 10
   attempts. Confirm with ops — some clients may want longer / shorter.
2. **API key rotation UX.** Do we expose rotation via an admin endpoint on
   the internal API, or is direct-DB rotation acceptable for now? Recommended:
   minimal admin endpoint.
3. **Rider phone exposure.** Does the client see the rider's phone in
   `dispatch.assigned`, or do we mask it and only expose it to the customer
   via the tracking page? Privacy + business call.
4. **Idempotency-Key TTL.** 24h is industry-standard. Confirm.
5. **Single shared rider pool.** Confirm all integration clients draw from
   the same rider pool. If a client demands their own riders, riders need a
   `merchantId` and dispatch routing changes.
6. **Tracking URL.** Phase 1 returns one in the dispatch response. Confirm
   we want our own tracking page, or whether some clients prefer to render
   their own using `/location` + `/track-stream`.

---

## What is explicitly **not** in scope here

- Refactoring the existing internal `/auth`, `/orders`, `/riders`,
  `/merchants` routes to match the new response envelope / validation /
  error-handling patterns. The new patterns apply to `/api/v1/external/*`
  only; backporting them is a separate initiative.
- Full multi-tenancy (`tenant_id` on every table). Each integration client is
  modelled as a `Merchant` row sharing the rider pool. Revisit if a client
  ever needs isolated riders or data.
- Object storage for POD images. Files continue to land in the local
  `uploads/` directory. Migrating to S3-compatible storage is on the
  not-yet-implemented backlog (`../CLAUDE.md §13`).
- Production-shape Dockerfile. The current image runs `npm run dev`. A
  multi-stage prod image is its own task.
- Admin UI for zones, API keys, or webhook inspection. Backend endpoints
  only; UI work is a follow-on.

---

## Gumza integration — contract bend

After Phases 1–4 shipped, NEWSYT and Gumza (`Easybox-zucchini/backend`) were
wired together. Both sides bent slightly to meet in the middle so neither has
to maintain a translation layer.

### NEWSYT side (provider)

- **Event names** — `dispatch.collected` renamed to `dispatch.picked_up` to
  match the more standard naming Gumza was already using. Added
  `dispatch.created` emitted on `POST /dispatches` so consumers learn the
  dispatch id via webhook in addition to the synchronous response. Full event
  set is now:

  ```
  dispatch.created
  dispatch.assigned
  dispatch.picked_up
  dispatch.en_route
  dispatch.delivered
  dispatch.failed
  dispatch.cancelled
  dispatch.payment_collected
  ```

- **Signature format** — switched from Stripe-style single header
  `X-Easybox-Signature: t=<unix>,v1=<hex>` to GitHub-style two-header:

  ```
  X-Easybox-Signature: sha256=<hex>
  X-Easybox-Timestamp: <unix>
  ```

  Algorithm unchanged — HMAC-SHA256 over `<timestamp>.<raw body>`. Tolerance
  still 5 minutes. `signWebhookPayload` / `verifyWebhookSignature` in
  `src/lib/crypto.ts` updated accordingly.

- **Webhook payload field aliases** — every webhook now carries both naming
  conventions so consumers can pick whichever they prefer:
  - top-level `timestamp` alongside `occurred_at`
  - `data.order_reference` alongside `data.external_id`
  - `data.rider.id` (our internal `Rider.id`) added
  - `data.rider.vehicle_plate` (alias of `bike_reg` on the model side)

### Gumza side (consumer) — `Easybox-zucchini/backend`

- `src/modules/dispatch/dispatch.service.ts` `callEasyboxCreateDispatch`
  rewritten to NEWSYT's contract:
  - URL: `POST {EASYBOX_API_URL}/api/v1/external/dispatches`
  - Auth: `X-API-Key: <ebx_id>.<secret>` (the full string from
    `EASYBOX_API_KEY` env, as issued by NEWSYT's
    `POST /admin/merchants/:id/api-key`)
  - Adds `Idempotency-Key: <uuid>` on every call
  - Body shape: `{ external_id, customer, drop_off, pickup, amount, currency,
    payment_type, package_notes? }`
  - Parses `{ success, data: { id, status, eta_minutes, ... } }` envelope and
    surfaces `data.id` as the dispatch id

- `cancelDispatch` similarly rewired:
  `POST /api/v1/external/dispatches/:id/cancel` with `X-API-Key`,
  `Idempotency-Key`, body `{ reason, confirm_fee: true }`. Gumza staff
  cancellations override the in-progress fee by default; surfacing the fee
  back to the customer is a future enhancement.

- `dispatch.payment_collected` added to `EASYBOX_EVENT_TYPES`. The handler
  short-circuits these as info-only: it logs and acks 200 but does not write
  to `dispatch_events` or trigger any order state transition. Gumza tracks
  its own M-Pesa / card flows. Reconciliation against NEWSYT's POD payment
  is a future enhancement.

- `EASYBOX_EVENT_TO_STATUS` became `Partial<Record<...>>` because
  `payment_collected` has no associated dispatch status. The handler returns
  `dispatchEvent: null` for these events; the idempotency store accepts a
  null `orderId`.

### Env vars that need to be set at deployment

| Side | Var | Value source |
|---|---|---|
| Gumza | `EASYBOX_API_URL` | NEWSYT's base URL (e.g. `https://easybox.example.com`) |
| Gumza | `EASYBOX_API_KEY` | The `api_key.full` string returned **once** by NEWSYT's `POST /admin/merchants/:id/api-key` |
| Gumza | `EASYBOX_WEBHOOK_SECRET` | The `webhook_secret.secret` string returned **once** by NEWSYT's `PUT /admin/merchants/:id/webhook` |
| Gumza | `PICKUP_ADDRESS`, `PICKUP_PHONE` | The merchant's pickup point — Gumza sends these on every dispatch |
| NEWSYT | (operator runs) `PUT /admin/merchants/:id/webhook` with `{ "url": "<gumza public URL>/webhooks/dispatch/easybox", "rotate_secret": true }` to set the outbound webhook target |

### What was NOT bent

- NEWSYT continues to **require** `Idempotency-Key` on every mutating
  external call. Gumza now sends one. Other future consumers must too.
- NEWSYT's `{ success, data }` envelope is unchanged. Gumza unwraps it.
- NEWSYT's per-merchant external rate limit is unchanged.
- NEWSYT's `dispatch.failed` covers both Gumza's `dispatch.failed` and
  `dispatch.arrived` semantics. There is no separate `arrived` event from
  NEWSYT today — adding one is on the backlog if a client needs the
  intermediate signal.

---

## Pending: deployment + smoke test

Both NEWSYT and Gumza typecheck clean against the connected contract. The
end-to-end smoke test was **deferred** until both are deployed to a real
environment — running it locally requires standing up the full Gumza
multi-tenant bootstrap (tenant + channel + customer + payment-gated order in
READY status) plus making my local NEWSYT reachable from a hosted Gumza,
which is more setup than value for a wire-shape verification.

### Acceptance criteria once deployed

Drive a single order through the integrated stack and verify each leg:

| Leg | What to verify | How |
|---|---|---|
| 1. **Dispatch outbound** (Gumza → NEWSYT) | `POST /api/v1/external/dispatches` succeeds; NEWSYT returns `dispatch_id`; Gumza stores it on the order. | Trigger via Gumza's `POST /api/v1/orders/:orderId/dispatch` (staff API). Check NEWSYT logs for the inbound request, check the Gumza order row for `dispatch_id`. |
| 2. **`dispatch.created` webhook** | NEWSYT immediately fires `dispatch.created`; Gumza receives, HMAC verifies, logs `Processing Easybox webhook`. | Check Gumza app logs + the `OutboundWebhook` row on NEWSYT — should be `status=SUCCESS, attempts=1`. |
| 3. **`dispatch.assigned`** | A NEWSYT dispatcher assigns a rider; Gumza receives the webhook, records the dispatch_event, updates `Order.rider_*` columns. | NEWSYT dashboard `PATCH /orders/:id/assign`. Verify the Gumza order row + customer WhatsApp notification (best-effort, won't fail the test if no channel). |
| 4. **`dispatch.picked_up` → Gumza order DISPATCHED** | Rider marks PICKED_UP on NEWSYT; Gumza receives, transitions order to DISPATCHED via `orderService.dispatchOrder`. | NEWSYT rider app `PATCH /orders/:id/status` → `PICKED_UP`. Check Gumza order status. |
| 5. **`dispatch.en_route` → Gumza order EN_ROUTE** | Same with IN_TRANSIT. | NEWSYT rider `PATCH /orders/:id/status` → `IN_TRANSIT`. |
| 6. **`dispatch.delivered` → Gumza order DELIVERED** | Same with DELIVERED. | NEWSYT rider `PATCH /orders/:id/status` → `DELIVERED` (or POD upload). |
| 7. **`dispatch.payment_collected`** (COD only) | Rider records POD payment on NEWSYT; Gumza acks 200, logs `Easybox info-only event — acknowledged, not stored`, no order state change. | NEWSYT rider `POST /orders/:id/payment`. Check Gumza logs only. |
| 8. **HMAC failure path** | An untrusted request to Gumza's webhook endpoint is rejected. | `curl` Gumza's webhook URL with no `X-Easybox-Signature` → expect `401 INVALID_SIGNATURE`. |
| 9. **Idempotency replay** | Re-POSTing a dispatch with the same `Idempotency-Key` returns the original response. | Compare two responses byte-for-byte. |

### Things to watch for during the smoke test

- **Event-name version skew.** Older NEWSYT clients in the wild might still
  send `dispatch.collected`. Gumza's enum only knows `dispatch.picked_up` now.
  After deploy, double-check both sides match.
- **Webhook URL.** Gumza's webhook receiver lives at
  `POST {gumza}/webhooks/dispatch/easybox`. Set NEWSYT's webhook URL
  accordingly via `PUT /admin/merchants/:id/webhook`. Trailing slashes
  matter to some routers — don't add one.
- **Time skew.** The two-header signature scheme uses a 5-minute tolerance.
  If the hosts have NTP drift > 5 min, every webhook will fail HMAC. Run
  `date -u` on both hosts as a sanity check.
- **Webhook outage.** Take down Gumza for ~30s in the middle of the test
  and confirm BullMQ's exponential backoff catches up. The
  `OutboundWebhook` row should end up at `status=SUCCESS, attempts>1`.
- **The `getByTrackingToken` lookup quirk.** Gumza's webhook handler
  resolves the order via `getLatestDispatchEventByDispatchId(dispatch_id)`
  on every event after the first — which works because Gumza records its
  own `dispatch_events` row on `createDispatch`. If the row is somehow
  missing (e.g., dispatch was created out-of-band, bypassing Gumza's
  service), the handler falls back to `getByTrackingToken(order_reference)`
  which will not find the order. This is a Gumza-internal correctness issue
  surfaced by NEWSYT — worth noting but not a blocker for the smoke test.

### Out-of-scope at smoke-test time (deferred features)

- **GPS / live tracking** (NEWSYT Phase 2) — Gumza's customer tracking page
  uses its own `tracking_token` flow today. Wiring `GET /location` +
  `/track-stream` into that page is a separate piece of work.
- **Quotes / fees / zones** (NEWSYT Phase 3) — Gumza doesn't call
  `POST /quotes` before dispatching yet. Showing the delivery fee at
  checkout is a follow-up.
- **POD payment reconciliation** — `dispatch.payment_collected` is logged
  but not used to mark the Gumza order as paid. Adding this requires
  cross-referencing with Gumza's own M-Pesa / card records and is a
  payment-domain change rather than an integration change.
- **Cancellation fee surfacing** — Gumza currently sends
  `confirm_fee: true` blindly. Surfacing the fee back to the customer (or
  the staff dashboard) before confirming is a Gumza-side UX change.