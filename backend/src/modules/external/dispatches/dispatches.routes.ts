import { Router } from "express";
import { prisma } from "../../../prisma";
import { sendSuccess } from "../../../shared/http/responses";
import { requireIdempotency, checkIdempotencyReplay, recordIdempotentResponse } from "../middleware/idempotency";
import {
  CancelDispatchSchema,
  CreateDispatchSchema,
  ListDispatchQuerySchema,
} from "./dispatches.dto";
import {
  createDispatch,
  getDispatchById,
  listDispatches,
} from "./dispatches.service";
import { cancelDispatch } from "./cancel.service";
import { toDispatchView } from "./dispatches.mapper";
import { publishCancellationEvent, publishDispatchCreated } from "../webhooks/dispatchEvents";
import locationRoutes from "../location/location.routes";

const router = Router();

// Phase 2: GPS / live tracking — mounted before the `/:id` collection route
// so /dispatches/:id/location and /dispatches/:id/track-stream resolve to the
// location handlers rather than being consumed by the `:id` matcher.
router.use("/:id", locationRoutes);

router.post(
  "/:id/cancel",
  requireIdempotency,
  checkIdempotencyReplay,
  async (req, res, next) => {
    try {
      const input = CancelDispatchSchema.parse(req.body);
      const merchant = req.merchant!;
      const idempotency = req.idempotency!;

      const outcome = await cancelDispatch({
        merchantId: merchant.id,
        dispatchId: req.params.id,
        reason: input.reason,
        confirmFee: input.confirm_fee,
      });

      const withRider = await prisma.order.findUnique({
        where: { id: outcome.order.id },
        include: { rider: true },
      });

      const envelope = {
        success: true as const,
        data: {
          ...toDispatchView(withRider!),
          cancellation_fee: outcome.fee,
          currency: outcome.currency,
          cancel_reason: input.reason,
        },
      };

      await publishCancellationEvent(outcome.order, {
        reason: input.reason,
        fee: outcome.fee,
        currency: outcome.currency,
        cancelledBy: "merchant",
      });

      await recordIdempotentResponse(merchant.id, idempotency.key, idempotency.requestHash, 200, envelope);
      return res.status(200).json(envelope);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  requireIdempotency,
  checkIdempotencyReplay,
  async (req, res, next) => {
    try {
      const input = CreateDispatchSchema.parse(req.body);
      const merchant = req.merchant!;
      const idempotency = req.idempotency!;

      const order = await createDispatch(merchant.id, input);
      const view = toDispatchView(order);
      const envelope = { success: true as const, data: view };

      await publishDispatchCreated(order);

      await recordIdempotentResponse(merchant.id, idempotency.key, idempotency.requestHash, 202, envelope);
      return res.status(202).json(envelope);
    } catch (err) {
      next(err);
    }
  }
);

router.get("/", async (req, res, next) => {
  try {
    const query = ListDispatchQuerySchema.parse(req.query);
    const orders = await listDispatches(req.merchant!.id, {
      externalId: query.external_id,
      limit: query.limit,
    });
    return sendSuccess(res, orders.map(toDispatchView), 200, { count: orders.length });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const order = await getDispatchById(req.merchant!.id, req.params.id);
    return sendSuccess(res, toDispatchView(order));
  } catch (err) {
    next(err);
  }
});

export default router;
