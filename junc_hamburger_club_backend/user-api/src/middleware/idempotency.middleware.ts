// POST /api/v1/orders 向け: Idempotency-Key ヘッダを処理する。
//
// 挙動:
//   - ヘッダなし → 素通り
//   - 既に SUCCEEDED/FAILED の同キー行が存在 → 保存レスポンスを再生して終了
//   - PENDING の同キー行が存在 → 409 ORDER_IDEMPOTENCY_IN_PROGRESS
//   - request_hash が異なる → 422 ORDER_IDEMPOTENCY_CONFLICT
//   - 新規 → PENDING 行を INSERT し、req.idempotency に状態を渡す。
//            handler は正常終了時 markIdempotencySucceeded() を呼ぶ。
//
// 失敗パス (エラー throw) は res 書き出し後に markIdempotencyFailed() を呼ばず
// 行を残したままにする (再試行可能)。これは「同じキーで異なる内容」というより
// 「同じキー同じ内容で再送したら最終的に成功した」を想定した設計。

import { NextFunction, Response } from 'express';
import { createHash } from 'crypto';
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AuthRequest } from '../types';
import { Errors } from '../lib/errors';

export interface IdempotencyContext {
  key: string;
  requestHash: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    idempotency?: IdempotencyContext;
  }
}

function hashBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
}

export async function idempotency(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const headerKey = req.get('Idempotency-Key');
  if (!headerKey) return next();
  const userId = req.user!.userId;
  const requestHash = hashBody(req.body);

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT status, request_hash, response_body, response_status FROM idempotency_keys WHERE user_id = ? AND idempotency_key = ?',
    [userId, headerKey],
  );

  if (rows.length > 0) {
    const row = rows[0] as {
      status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
      request_hash: string;
      response_body: unknown;
      response_status: number | null;
    };
    if (row.request_hash !== requestHash) {
      return next(Errors.idempotencyConflict(headerKey));
    }
    if (row.status === 'PENDING') {
      return next(Errors.idempotencyInProgress(headerKey));
    }
    // SUCCEEDED / FAILED は保存済みレスポンスを再生
    res.status(row.response_status ?? 200).json(row.response_body);
    return;
  }

  // 新規行: PENDING
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO idempotency_keys (user_id, idempotency_key, request_hash, status)
       VALUES (?, ?, ?, 'PENDING')`,
      [userId, headerKey, requestHash],
    );
  } catch (err) {
    // 競合で UNIQUE 違反 → もう一方が先に PENDING を立てた
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      return next(Errors.idempotencyInProgress(headerKey));
    }
    throw err;
  }

  req.idempotency = { key: headerKey, requestHash };
  next();
}

// controller から成功時に呼ぶ: SUCCEEDED + response を保存
export async function markIdempotencySucceeded(
  userId: number,
  ctx: IdempotencyContext,
  orderId: number,
  responseStatus: number,
  responseBody: unknown,
): Promise<void> {
  await pool.query(
    `UPDATE idempotency_keys
     SET status = 'SUCCEEDED', order_id = ?, response_status = ?, response_body = ?
     WHERE user_id = ? AND idempotency_key = ?`,
    [orderId, responseStatus, JSON.stringify(responseBody), userId, ctx.key],
  );
}

// エラー時に呼ぶ: PENDING 行を削除し、同じキーでの再試行を可能にする。
// PENDING のまま残すと ORDER_IDEMPOTENCY_IN_PROGRESS が永続してしまうため。
// (保存して FAILED にする設計ではなく、行削除によって「失敗は履歴に残さない」方針)
export async function markIdempotencyFailed(
  userId: number,
  ctx: IdempotencyContext,
): Promise<void> {
  await pool.query(
    `DELETE FROM idempotency_keys
     WHERE user_id = ? AND idempotency_key = ? AND status = 'PENDING'`,
    [userId, ctx.key],
  );
}
