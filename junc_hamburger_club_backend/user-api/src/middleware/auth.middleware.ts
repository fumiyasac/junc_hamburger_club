import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';
import { Errors } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

// アクセストークン検証 + is_active 確認。
// JWT 検証と DB の is_active 確認を毎回行う (キャッシュは入れていない)。
// 1 req あたり +1 クエリだが、ほぼ全エンドポイントが DB アクセスをしているため許容。
// 必要になったら Redis で 60 秒 TTL キャッシュに移行。
export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(Errors.tokenMissing());
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(Errors.tokenExpired());
    }
    return next(Errors.tokenInvalid());
  }

  // is_active と、sid のセッション有効性を同時確認:
  //   - users.is_active = 1 必須
  //   - refresh_sessions に sid が存在し revoked_at IS NULL 必須
  // これにより password 変更後・admin 無効化後・logout 後も、残り最大 15 分の
  // access token を即時失効させる (強整合性)。
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.is_active, s.id AS session_id, s.revoked_at
     FROM users u
     LEFT JOIN refresh_sessions s ON s.id = ? AND s.user_id = u.id
     WHERE u.id = ?`,
    [payload.sid, payload.userId],
  );
  if (rows.length === 0 || !rows[0]['is_active']) {
    return next(Errors.userDeactivated());
  }
  const sessionId = rows[0]['session_id'];
  const revokedAt = rows[0]['revoked_at'];
  if (!sessionId || revokedAt) {
    return next(Errors.tokenInvalid());
  }

  req.user = { userId: payload.userId, email: payload.email };
  next();
}
