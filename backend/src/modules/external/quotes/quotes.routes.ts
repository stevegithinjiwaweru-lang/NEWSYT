import { Router } from "express";
import { sendSuccess } from "../../../shared/http/responses";
import { QuoteRequestSchema } from "./quotes.dto";
import { computeQuote } from "./quotes.service";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const input = QuoteRequestSchema.parse(req.body);
    const quote = await computeQuote(input);
    return sendSuccess(res, quote);
  } catch (err) {
    next(err);
  }
});

export default router;
