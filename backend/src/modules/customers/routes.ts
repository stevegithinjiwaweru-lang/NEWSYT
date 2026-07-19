import express from "express";
import { registerCustomer, loginCustomer, refreshToken, logoutCustomer, getMe, updateMe } from "./controller";
import { validateRegister, validateLogin, validateRefresh, validateUpdateMe } from "./validators";
import authMiddleware from "../../../middlewares/auth";

const router = express.Router();

/**
 * @openapi
 * /api/customers/register:
 *   post:
 *     summary: Register a new customer
 *     tags:
 *       - Customers
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerRegister'
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/register", validateRegister, registerCustomer);

/**
 * @openapi
 * /api/customers/login:
 *   post:
 *     summary: Customer login
 *     tags:
 *       - Customers
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerLogin'
 *     responses:
 *       200:
 *         description: OK
 */
router.post("/login", validateLogin, loginCustomer);

router.post("/refresh", validateRefresh, refreshToken);
router.post("/logout", logoutCustomer);

router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, validateUpdateMe, updateMe);

export default router;
