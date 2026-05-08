import jwt, { SignOptions } from 'jsonwebtoken';

// ─── Payload chứa trong token ─────────────────────────────────────────────────
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

// ─── Access Token (sống ngắn: 15m, 30m) ──────────────────────────────────────
export const signAccessToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_ACCESS_SECRET as string;
  const expiresIn = (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as SignOptions['expiresIn'];
  return jwt.sign(payload, secret, { expiresIn });
};

// ─── Refresh Token (sống dài: 7d, 30d) ───────────────────────────────────────
export const signRefreshToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_REFRESH_SECRET as string;
  const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
  return jwt.sign(payload, secret, { expiresIn });
};

// ─── Verify Access Token ──────────────────────────────────────────────────────
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as TokenPayload;
};

// ─── Verify Refresh Token ─────────────────────────────────────────────────────
export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as TokenPayload;
};
