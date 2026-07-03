import express from 'express';
import { listMerchants, createMerchant, updateMerchant } from '../controllers/merchantsController';
import authMiddleware from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createMerchantSchema, updateMerchantSchema } from '../validators/merchants';

const router = express.Router();
const requireAuth = authMiddleware;

router.get('/', requireAuth, listMerchants);
router.post('/', requireAuth, validate(createMerchantSchema), createMerchant);
router.patch('/:id', requireAuth, validate(updateMerchantSchema), updateMerchant);

export default router;
