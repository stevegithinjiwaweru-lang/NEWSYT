import express from 'express';
import { register, login, refresh, logout } from '../controllers/authController';
import { validate } from '../middlewares/validate';
import { registerSchema, loginSchema, refreshSchema } from '../validators/auth';

const router = express.Router();

router.get('/', (_req, res) => res.json({ ok: true, service: 'auth' }));
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', logout);

export default router;
