// Refresh Token の発行・ローテーション・再利用検知。
// すべて pool を通して (トランザクションは呼び出し側で管理するか、短期 upsert のみ)。
//
// 設計:
//   - 1 デバイス = 1 family_id。login 時に new family 発行
//   - rotate 時: token_hash → prev_token_hash に退避、新 hash を書き込み (90 秒 grace)
//   - 再利用検知: prev_token_hash と一致で grace 期間外 or revoked_at が立っている → 同 family 全失効
//   - revoked_at が立っている行は常に拒否

import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { generateRefreshToken, hashToken } from './tokens';

export interface IssueResult {
  sessionId: string;
  refreshToken: string;        // plaintext
  expiresAtMs: number;
}

export type RotationResult =
  | { ok: true; sessionId: string; refreshToken: string; expiresAtMs: number }
  | { ok: false; code: 'TOKEN_INVALID' | 'TOKEN_REUSE_DETECTED' | 'TOKEN_EXPIRED' };

export type RevokedReason =
  | 'LOGOUT' | 'ROTATED' | 'REUSE_DETECTED'
  | 'PASSWORD_CHANGED' | 'ACCOUNT_DEACTIVATED'
  | 'USER_DELETED' | 'ADMIN_REVOKED';

// 新規ログイン時: 新しい family で発行
export async function issueNewSession(
  pool: Pool,
  userId: number,
  meta: { userAgent?: string | null; ip?: string | null },
): Promise<IssueResult> {
  const { plaintext, hash } = generateRefreshToken();
  const sessionId = randomUUID();
  const familyId = sessionId;  // 初回は session = family
  const expiresAtMs = Date.now() + env.REFRESH_TOKEN_TTL_SEC * 1000;

  await pool.query(
    `INSERT INTO refresh_sessions
       (id, user_id, family_id, token_hash, user_agent, ip, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, familyId, hash, meta.userAgent ?? null, meta.ip ?? null, new Date(expiresAtMs)],
  );
  return { sessionId, refreshToken: plaintext, expiresAtMs };
}

// 全ユーザー失効 (password change / deactivate / delete / admin revoke)
export async function revokeAllForUser(
  pool: Pool,
  userId: number,
  reason: RevokedReason,
): Promise<number> {
  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE refresh_sessions
     SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = ?
     WHERE user_id = ? AND revoked_at IS NULL`,
    [reason, userId],
  );
  return res.affectedRows;
}

// family 単位で失効 (再利用検知時)
export async function revokeFamily(
  pool: Pool,
  familyId: string,
  reason: RevokedReason,
): Promise<void> {
  await pool.query(
    `UPDATE refresh_sessions
     SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = ?
     WHERE family_id = ? AND revoked_at IS NULL`,
    [reason, familyId],
  );
}

// セッション単位で失効 (logout)
export async function revokeSession(
  pool: Pool,
  sessionId: string,
  reason: RevokedReason,
): Promise<void> {
  await pool.query(
    `UPDATE refresh_sessions
     SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = ?
     WHERE id = ? AND revoked_at IS NULL`,
    [reason, sessionId],
  );
}

// ローテーション: 既存の refresh plaintext を受け取り、新トークンに交換する。
// 競合を避けるため tx + SELECT FOR UPDATE。
export async function rotate(
  pool: Pool,
  providedPlaintext: string,
  meta: { userAgent?: string | null; ip?: string | null },
): Promise<RotationResult> {
  const providedHash = hashToken(providedPlaintext);
  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // current の一致を先に (有効な行)
    const [currentRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id, family_id, expires_at, revoked_at
       FROM refresh_sessions
       WHERE token_hash = ?
       FOR UPDATE`,
      [providedHash],
    );

    if (currentRows.length > 0) {
      const row = currentRows[0] as {
        id: string; user_id: number; family_id: string; expires_at: Date; revoked_at: Date | null;
      };
      if (row.revoked_at) {
        await conn.commit();
        return { ok: false, code: 'TOKEN_INVALID' };
      }
      if (row.expires_at.getTime() < Date.now()) {
        await conn.commit();
        return { ok: false, code: 'TOKEN_EXPIRED' };
      }
      // ローテーション: 旧トークンを prev に退避、新トークン発行
      const { plaintext: newPlain, hash: newHash } = generateRefreshToken();
      const graceUntil = new Date(Date.now() + env.REFRESH_ROTATION_GRACE_SEC * 1000);
      const newExpiresAtMs = Date.now() + env.REFRESH_TOKEN_TTL_SEC * 1000;
      await conn.query(
        `UPDATE refresh_sessions
         SET token_hash = ?, prev_token_hash = ?, prev_valid_until = ?,
             last_used_at = CURRENT_TIMESTAMP, expires_at = ?
         WHERE id = ?`,
        [newHash, providedHash, graceUntil, new Date(newExpiresAtMs), row.id],
      );
      await conn.commit();
      return { ok: true, sessionId: row.id, refreshToken: newPlain, expiresAtMs: newExpiresAtMs };
    }

    // prev_token_hash との一致 → grace 期間内かつ UA/IP が一致していれば再送扱い
    const [prevRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id, family_id, token_hash, user_agent, ip,
              prev_valid_until, revoked_at
       FROM refresh_sessions
       WHERE prev_token_hash = ?
       FOR UPDATE`,
      [providedHash],
    );

    if (prevRows.length > 0) {
      const row = prevRows[0] as {
        id: string; user_id: number; family_id: string; token_hash: string;
        user_agent: string | null; ip: string | null;
        prev_valid_until: Date | null; revoked_at: Date | null;
      };

      // revoked か grace 外 → 再利用検知: family 全体を失効
      const graceExpired = !row.prev_valid_until || row.prev_valid_until.getTime() < Date.now();
      // UA/IP が元セッションと食い違う場合も盗用と判断 (grace 内でも拒否)
      const uaMismatch = !!row.user_agent && !!meta.userAgent && row.user_agent !== meta.userAgent;
      const ipMismatch = !!row.ip && !!meta.ip && row.ip !== meta.ip;
      if (row.revoked_at || graceExpired || uaMismatch || ipMismatch) {
        await conn.query(
          `UPDATE refresh_sessions
           SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = 'REUSE_DETECTED'
           WHERE family_id = ? AND revoked_at IS NULL`,
          [row.family_id],
        );
        await conn.commit();
        return { ok: false, code: 'TOKEN_REUSE_DETECTED' };
      }

      // grace 内: 新トークンをクライアントが受け取り損ねたネットワーク再送と解釈し、
      // 現在有効な token (row.token_hash) を prev に押し出して新トークンを発行。
      // この結果 "旧 current" も次の grace まで生きる。
      const { plaintext: newPlain, hash: newHash } = generateRefreshToken();
      const graceUntil = new Date(Date.now() + env.REFRESH_ROTATION_GRACE_SEC * 1000);
      const newExpiresAtMs = Date.now() + env.REFRESH_TOKEN_TTL_SEC * 1000;
      await conn.query(
        `UPDATE refresh_sessions
         SET token_hash = ?, prev_token_hash = ?, prev_valid_until = ?,
             last_used_at = CURRENT_TIMESTAMP, expires_at = ?
         WHERE id = ?`,
        [newHash, row.token_hash, graceUntil, new Date(newExpiresAtMs), row.id],
      );
      meta;  // 未使用警告回避
      await conn.commit();
      return { ok: true, sessionId: row.id, refreshToken: newPlain, expiresAtMs: newExpiresAtMs };
    }

    await conn.commit();
    return { ok: false, code: 'TOKEN_INVALID' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// token_hash → user_id と session_id を引く (middleware では使わない。logout 等で使用)
export async function findActiveSessionByToken(
  pool: Pool,
  plaintext: string,
): Promise<{ sessionId: string; userId: number } | null> {
  const hash = hashToken(plaintext);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, user_id
     FROM refresh_sessions
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
    [hash],
  );
  if (rows.length === 0) return null;
  const r = rows[0] as { id: string; user_id: number };
  return { sessionId: r.id, userId: r.user_id };
}
