// Access Token (JWT) と Refresh Token (不透明文字列) の発行 + ハッシュ化
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { env } from '../config/env';

export interface AccessTokenPayload {
  userId: number;
  email: string;
  sid: string;  // refresh_sessions.id
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL_SEC });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

// 不透明 Refresh Token を生成 (32 bytes = 64 hex)。
// 戻り値は {plaintext, hash}。plaintext はクライアントに返し、hash を DB 保存する。
export function generateRefreshToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString('hex');
  return { plaintext, hash: hashToken(plaintext) };
}

export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}
