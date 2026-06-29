import { Router } from "express";
import { Zone } from "@prisma/client";
import { sendSuccess } from "../../../shared/http/responses";
import { parseOperatingHours } from "../../../lib/geo";
import { listActiveZones } from "./zones.service";

const router = Router();

function toPublicZone(zone: Zone) {
  return {
    id: zone.id,
    name: zone.name,
    base_fee: zone.baseFee,
    per_km_fee: zone.perKmFee,
    currency: zone.currency,
    operating_hours: parseOperatingHours(zone.operatingHours),
    daily_cutoff: zone.dailyCutoff,
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const zones = await listActiveZones();
    return sendSuccess(res, zones.map(toPublicZone), 200, { count: zones.length });
  } catch (err) {
    next(err);
  }
});

export default router;
