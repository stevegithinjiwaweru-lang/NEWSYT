import express from 'express';
import { listRiders, createRider, updateRider, deleteRider } from '../controllers/ridersController';
import authMiddleware from '../middlewares/auth';

const router = express.Router();
const requireAuth = authMiddleware;

router.get('/', requireAuth, listRiders);
router.post('/', requireAuth, createRider);
router.patch('/:id', requireAuth, updateRider);
router.delete('/:id', requireAuth, deleteRider);

export default router;
