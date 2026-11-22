import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { UserRow } from '../types';
import { RowDataPacket } from 'mysql2';
import { AppError } from '../lib/errors';
import { signAccessToken } from '../lib/tokens';
import { env } from '../config/env';
import {
  issueNewSession, rotate, findActiveSessionByToken, revokeSession,
} from '../lib/refresh_rotation';

function clientMeta(req: Request) {
  return {
    userAgent: req.get('User-Agent')?.slice(0, 255) ?? null,
    ip: (req.ip ?? req.socket.remoteAddress ?? '').slice(0, 45) || null,
  };
}

function authPayload(
  user: { id: number; name: string; email: string; profile_image_url: string | null; created_at: Date | string },
  sessionId: string,
  refreshToken: string,
  refreshExpiresAtMs: number,
) {
  const accessToken = signAccessToken({ userId: user.id, email: user.email, sid: sessionId });
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: env.ACCESS_TOKEN_TTL_SEC,
    refreshTokenExpiresIn: Math.floor((refreshExpiresAtMs - Date.now()) / 1000),
    user: {
      id: String(user.id),
      name: user.name,
      email: user.email,
      profileImageUrl: user.profile_image_url,
      createdAt: user.created_at,
    },
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body as { name: string; email: string; password: string };

  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ?',
    [email],
  );
  if (existing.length > 0) {
    throw new AppError('USER_EMAIL_IN_USE', 'このメールアドレスは既に登録されています', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [name, email, passwordHash],
  );
  const userId = (result as { insertId: number }).insertId;

  const session = await issueNewSession(pool, userId, clientMeta(req));
  res.status(201).json({
    success: true,
    data: authPayload(
      { id: userId, name, email, profile_image_url: null, created_at: new Date() },
      session.sessionId, session.refreshToken, session.expiresAtMs,
    ),
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM users WHERE email = ? AND is_active = 1',
    [email],
  );
  const user = rows[0] as UserRow | undefined;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError('USER_LOGIN_FAILED', 'メールアドレスまたはパスワードが違います', 401);
  }

  const session = await issueNewSession(pool, user.id, clientMeta(req));
  res.json({
    success: true,
    data: authPayload(user, session.sessionId, session.refreshToken, session.expiresAtMs),
  });
}

const REFRESH_TOKEN_FORMAT = /^[0-9a-f]{64}$/;

// POST /auth/refresh
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken || typeof refreshToken !== 'string' || !REFRESH_TOKEN_FORMAT.test(refreshToken)) {
    throw new AppError('VALIDATION_FAILED', 'refreshToken が不正です', 400, {
      issues: [{ field: 'refreshToken', message: 'required 64-hex string' }],
    });
  }

  const result = await rotate(pool, refreshToken, clientMeta(req));
  if (!result.ok) {
    const map = {
      TOKEN_INVALID: () => new AppError('TOKEN_INVALID', '認証トークンが不正です', 401),
      TOKEN_EXPIRED: () => new AppError('TOKEN_EXPIRED', 'トークンの有効期限が切れています', 401),
      TOKEN_REUSE_DETECTED: () =>
        new AppError('TOKEN_REUSE_DETECTED', 'トークンの再利用を検知したため全セッションを失効しました', 401),
    };
    throw map[result.code]();
  }

  // ユーザー情報を取り直し、is_active 確認
  const [urows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, email, profile_image_url, is_active, created_at FROM users WHERE id = (SELECT user_id FROM refresh_sessions WHERE id = ?)',
    [result.sessionId],
  );
  if (urows.length === 0 || !urows[0]['is_active']) {
    throw new AppError('USER_DEACTIVATED', 'アカウントが無効化されています', 401);
  }
  const u = urows[0] as RowDataPacket;

  res.json({
    success: true,
    data: authPayload(
      {
        id: u['id'] as number,
        name: u['name'] as string,
        email: u['email'] as string,
        profile_image_url: u['profile_image_url'] as string | null,
        created_at: u['created_at'] as Date,
      },
      result.sessionId,
      result.refreshToken,
      result.expiresAtMs,
    ),
  });
}

// POST /auth/logout
export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken || typeof refreshToken !== 'string' || !REFRESH_TOKEN_FORMAT.test(refreshToken)) {
    // idempotent: 不正なトークンでも 200 で返す (情報漏洩を避ける)
    res.json({ success: true });
    return;
  }
  const session = await findActiveSessionByToken(pool, refreshToken);
  if (session) {
    await revokeSession(pool, session.sessionId, 'LOGOUT');
  }
  res.json({ success: true });
}
