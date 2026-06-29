import { Router } from "express";
import { requestId } from "./middleware/requestId";
import { apiKeyAuth } from "./middleware/apiKeyAuth";
import { externalRateLimit } from "./middleware/rateLimit";
import { externalErrorHandler, externalNotFound } from "./middleware/errorHandler";
import dispatchesRoutes from "./dispatches/dispatches.routes";
import quotesRoutes from "./quotes/quotes.routes";
import zonesRoutes from "./zones/zones.routes";

const router = Router();

router.use(requestId);
router.use(apiKeyAuth);
router.use(externalRateLimit);

router.use("/dispatches", dispatchesRoutes);
router.use("/quotes", quotesRoutes);
router.use("/zones", zonesRoutes);

router.use(externalNotFound);
router.use(externalErrorHandler);

export default router;
