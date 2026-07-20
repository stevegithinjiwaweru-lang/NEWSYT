/**
 * EASYBOX × ZUCCHINI DISPATCH INTEGRATION GUIDE
 * 
 * This document describes how the Easybox dispatch system integrates with the NEWSYT backend.
 * 
 * ## Architecture Overview
 * 
 * The integration operates bidirectionally:
 * 
 * 1. **Outbound (Zucchini → Easybox)**: Zucchini calls Easybox API endpoints to create/cancel dispatches
 * 2. **Inbound (Easybox → Zucchini)**: Easybox sends webhook events as dispatch status changes
 * 
 * ## Endpoints
 * 
 * ### Outbound API (requires Bearer token auth)
 * 
 * #### POST /api/v1/dispatches
 * Create a new dispatch. Called when an order is ready for pickup.
 * 
 * Request:
 * ```json
 * {
 *   "order_reference": "7f3c9a12-4e6b-4d1f-9c2a-1a2b3c4d5e6f",
 *   "pickup": {
 *     "address": "Zucchini Store, Nairobi",
 *     "latitude": -1.286389,
 *     "longitude": 36.817223,
 *     "contact_name": "Zucchini",
 *     "contact_phone": "+254700000000"
 *   },
 *   "delivery": {
 *     "address": "Apartment 4B, Riverside Drive, Westlands, Nairobi",
 *     "latitude": -1.265432,
 *     "longitude": 36.802109,
 *     "contact_name": "Asha Mwangi",
 *     "contact_phone": "+254712345678"
 *   },
 *   "package": {
 *     "description": "Order #7F3C9A12",
 *     "weight": 3.5,
 *     "value": 1850.00
 *   },
 *   "payment_on_delivery": {
 *     "enabled": true,
 *     "amount": 1850.00,
 *     "currency": "KES"
 *   }
 * }
 * ```
 * 
 * Response (201 Created):
 * ```json
 * {
 *   "ok": true,
 *   "dispatch_id": "EB-20260619-AB12CD",
 *   "status": "pending",
 *   "estimated_pickup": "2026-06-19T12:15:00Z",
 *   "estimated_delivery": "2026-06-19T13:00:00Z"
 * }
 * ```
 * 
 * #### POST /api/v1/dispatches/:dispatchId/cancel
 * Cancel an in-flight dispatch.
 * 
 * Request:
 * ```json
 * {
 *   "reason": "Customer cancelled order before pickup"
 * }
 * ```
 * 
 * Response (200 OK):
 * ```json
 * {
 *   "ok": true,
 *   "dispatch_id": "EB-20260619-AB12CD",
 *   "status": "cancelled",
 *   "cancelled_at": "2026-06-19T12:25:00Z"
 * }
 * ```
 * 
 * ### Inbound Webhooks (no auth required, signature-verified)
 * 
 * #### POST /webhooks/dispatch/easybox
 * Receive dispatch status updates from Easybox.
 * 
 * Required headers:
 * - `Content-Type: application/json`
 * - `X-Easybox-Timestamp: <Unix seconds>`
 * - `X-Easybox-Signature: sha256=<HMAC-SHA256 hex>`
 * 
 * Signature verification:
 * ```
 * payload = "{timestamp}.{rawBody}"
 * signature = HMAC-SHA256(payload, EASYBOX_WEBHOOK_SECRET)
 * header_signature = sha256={signature in hex}
 * ```
 * 
 * Webhook lifecycle (happy path):
 * 1. `dispatch.created` - Dispatch registered (status: PENDING)
 * 2. `dispatch.assigned` - Rider assigned (status: ASSIGNED)
 * 3. `dispatch.picked_up` - Package collected (status: PICKED_UP)
 * 4. `dispatch.en_route` - Rider on the way (status: EN_ROUTE, periodic location updates)
 * 5. `dispatch.arrived` - Rider at destination (status: ARRIVED)
 * 6. `dispatch.delivered` - Package handed over (status: DELIVERED)
 * 
 * Error branches:
 * - `dispatch.failed` - Delivery failed (customer not reachable, refused, wrong address, etc.)
 * - `dispatch.cancelled` - Dispatch cancelled by Easybox or via cancel API
 * 
 * Example payload:
 * ```json
 * {
 *   "event": "dispatch.assigned",
 *   "timestamp": "2026-06-19T12:05:00Z",
 *   "data": {
 *     "dispatch_id": "EB-20260619-AB12CD",
 *     "order_reference": "7f3c9a12-4e6b-4d1f-9c2a-1a2b3c4d5e6f",
 *     "status": "ASSIGNED",
 *     "rider": {
 *       "id": "RIDER-001",
 *       "name": "John Kamau",
 *       "phone": "+254722111222",
 *       "vehicle_type": "motorcycle",
 *       "vehicle_plate": "KMEA 123A"
 *     },
 *     "estimated_delivery": "2026-06-19T13:00:00Z"
 *   }
 * }
 * ```
 * 
 * Response (200 OK):
 * ```json
 * {
 *   "ok": true,
 *   "event": "dispatch.assigned",
 *   "dispatch_id": "cuid123",
 *   "received_at": "2026-06-19T12:05:00Z"
 * }
 * ```
 * 
 * ## Environment Variables
 * 
 * Required:
 * - `EASYBOX_WEBHOOK_SECRET` - Shared secret for webhook HMAC verification (min 32 chars)
 * - `EASYBOX_API_KEY` - Bearer token for Easybox API calls (set in client)
 * 
 * ## Database Schema
 * 
 * ### Dispatch Table
 * - `id`: Internal dispatch ID (cuid)
 * - `easyboxId`: Easybox dispatch ID (from webhook)
 * - `orderReference`: Order ID from Zucchini (unique)
 * - `orderId`: Internal Order FK (unique)
 * - `status`: DispatchStatus enum
 * - `riderId`: Assigned rider FK
 * - `pickupLat/Lng`, `deliveryLat/Lng`: Location coordinates
 * - `estimatedPickup/Delivery`, `actualPickupAt/DeliveryAt`: Timing
 * - `podEnabled/Amount/Currency/Collected`: Payment-on-delivery tracking
 * - `packageDescription/Weight/Value`: Package info
 * - `failureReason`, `cancellationReason`: Error details
 * - `events`: DispatchEvent records (audit trail)
 * - `metadata`: JSON payload from Easybox
 * 
 * ### DispatchEvent Table
 * Immutable event log for each status change:
 * - `dispatchId`: FK to Dispatch
 * - `event`: Event type string (e.g., "dispatch.assigned")
 * - `status`: DispatchStatus at time of event
 * - `lat/lng/accuracy`: Location if applicable
 * - `reason`: Failure reason if applicable
 * - `riderName/Phone`: Rider info snapshot
 * - `eventTimestamp`: Timestamp from Easybox
 * - `createdAt`: Server timestamp
 * 
 * ## Status Mapping
 * 
 * Easybox Status → Dispatch Status → Order Status
 * - CREATED → CREATED → (no change)
 * - ASSIGNED → ASSIGNED → ASSIGNED
 * - PICKED_UP → PICKED_UP → PICKED_UP
 * - EN_ROUTE → EN_ROUTE → IN_TRANSIT
 * - ARRIVED → ARRIVED → (no change)
 * - DELIVERED → DELIVERED → DELIVERED
 * - FAILED → FAILED → FAILED
 * - CANCELLED → CANCELLED → (depends on order state)
 * 
 * ## Error Handling
 * 
 * ### Webhook Signature Errors
 * - 401: Missing headers, invalid signature, or timestamp outside 5-minute window
 * - 400: Invalid payload (missing required fields)
 * - 500: Webhook processing failed
 * 
 * ### API Errors
 * - 400: Invalid request (missing required fields)
 * - 401: Unauthorized (missing/invalid Bearer token)
 * - 409: Conflict (dispatch already exists for order_reference)
 * - 500: Server error
 * 
 * ## Testing
 * 
 * Use the provided Postman collection (easybox-postman-collection.json):
 * 1. Set environment variables: `easyboxBaseUrl`, `easyboxApiKey`, `zucchiniBaseUrl`, `easyboxWebhookSecret`
 * 2. Create a dispatch: POST /v1/dispatches
 * 3. Send webhook events: POST /webhooks/dispatch/easybox (signatures auto-computed)
 * 4. Check dispatch status: Query database or via API
 * 
 * ## Replay Protection
 * 
 * Webhooks older than 5 minutes are rejected (checked via X-Easybox-Timestamp).
 * Deduplication on (event:dispatch_id:timestamp) tuple is recommended client-side.
 * 
 * ## Notes
 * 
 * - All timestamps in payloads are ISO-8601 strings
 * - Amounts are in major currency units (KES, not cents)
 * - GPS coordinates are decimal degrees (latitude, longitude)
 * - Vehicle type is a free string (e.g., "motorcycle", "van", "bicycle")
 * - POD (payment-on-delivery) data is only sent in delivered/failed events
 */
