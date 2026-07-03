import express from 'express';
import { listMerchants, createMerchant, updateMerchant } from '../controllers/merchantsController';
import authMiddleware from '../middlewares/auth';

const router = express.Router();
const requireAuth = authMiddleware;

router.get('/', requireAuth, listMerchants);
router.post('/', requireAuth, createMerchant);
router.patch('/:id', requireAuth, updateMerchant);

export default router;
