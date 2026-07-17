import jwt, { SignOptions } from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!ACCESS_SECRET) {
  throw new Error("JWT_SECRET is missing in .env");
}

if (!REFRESH_SECRET) {
  throw new Error("REFRESH_TOKEN_SECRET is missing in .env");
}

export interface JwtPayload {
  sub: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: {
  sub: string;
  role?: string;
}) {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: "15m",
  } as SignOptions);
}

export function signRefreshToken(payload: {
  sub: string;
}) {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: "7d",
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}