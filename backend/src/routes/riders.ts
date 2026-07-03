import express from 'express';
import { listRiders, createRider, updateRider, deleteRider } from '../controllers/ridersController';
import authMiddleware from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createRiderSchema, updateRiderSchema } from '../validators/riders';

const router = express.Router();
const requireAuth = authMiddleware;

router.get('/', requireAuth, listRiders);
router.post('/', requireAuth, validate(createRiderSchema), createRider);
router.patch('/:id', requireAuth, validate(updateRiderSchema), updateRider);
router.delete('/:id', requireAuth, deleteRider);

export default router;
