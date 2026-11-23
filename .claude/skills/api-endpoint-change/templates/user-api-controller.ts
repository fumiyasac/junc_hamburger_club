// junc_hamburger_club_backend/user-api/src/controllers/<topic>.controller.ts
//
// 統一エラー形式 (#65) 対応テンプレート: AppError を throw、未捕捉は
// error.middleware.ts が {success:false, error:{code,message,details}} に変換する。
// 認証コードは #66 で TOKEN_* / USER_DEACTIVATED に rename 済み。

import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AuthRequest } from '../types';
import { AppError, Errors } from '../lib/errors';

// --- Row → DTO 変換 ------------------------------------------------------
// snake_case 列を camelCase JSON に変換し、ID は必ず string で返す。
// DECIMAL 列は文字列で来るので parseFloat する。BOOLEAN は Boolean() で揃える。

interface ReviewRow {
  id: number;
  user_id: number;
  burger_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
}

function formatReview(row: ReviewRow) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    burgerId: String(row.burger_id),
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

// --- ハンドラ ------------------------------------------------------------
// route 側で wrapAsync(listReviews) で包むこと (Express 4 は async エラー自動 forward なし)

export async function listReviews(req: AuthRequest, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const offset = (page - 1) * limit;

  const [countRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM reviews',
  );
  const total = (countRows[0] as { total: number }).total;

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM reviews ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset],
  );

  res.json({
    success: true,
    data: {
      reviews: (rows as ReviewRow[]).map(formatReview),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    },
  });
}

export async function getReview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM reviews WHERE id = ?',
    [id],
  );
  if (rows.length === 0) {
    // 汎用 404 は Errors.resourceNotFound を使う
    throw Errors.resourceNotFound('review', id);
  }
  res.json({ success: true, data: formatReview(rows[0] as ReviewRow) });
}

export async function createReview(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { burgerId, rating, comment } = req.body as {
    burgerId: string; rating: number; comment?: string;
  };

  // バリデーションは validate middleware で VALIDATION_FAILED として処理される想定。
  // ここでは domain ルールのみ throw する。
  if (rating < 1 || rating > 5) {
    throw new AppError('VALIDATION_FAILED', 'rating は 1〜5 で指定してください', 400, {
      issues: [{ field: 'rating', message: 'must be 1..5' }],
    });
  }

  // 存在チェック
  const [burgerRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM burgers WHERE id = ? AND is_available = 1',
    [burgerId],
  );
  if (burgerRows.length === 0) {
    throw Errors.burgerNotFound(burgerId);
  }

  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO reviews (user_id, burger_id, rating, comment) VALUES (?, ?, ?, ?)',
    [userId, burgerId, rating, comment ?? null],
  );

  const [created] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM reviews WHERE id = ?', [result.insertId],
  );
  res.status(201).json({ success: true, data: formatReview(created[0] as ReviewRow) });
}
