import jwt, { SignOptions } from "jsonwebtoken";

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || "test_access_secret";

const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test_refresh_secret";

export interface JwtPayload {
  sub: string;
  role?: string;
  iat?: number;
  exp?: number;
}

// ------------------
// ACCESS TOKEN
// ------------------
export const signAccessToken = (payload: object): string => {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN as any) || "15m",
  } as SignOptions);
};

// ------------------
// REFRESH TOKEN
// ------------------
export const signRefreshToken = (payload: object): string => {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as any) || "7d",
  } as SignOptions);
};

// ------------------
// VERIFY ACCESS
// ------------------
export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
};

// ------------------
// VERIFY REFRESH
// ------------------
export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
};