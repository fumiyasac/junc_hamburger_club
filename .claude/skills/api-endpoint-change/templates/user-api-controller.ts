// junc_hamburger_club_backend/user-api/src/controllers/<topic>.controller.ts
//
// テンプレート: pool.query + formatEntity + {success, data} の既存パターン。
// burger.controller.ts の実装スタイルに合わせている。

import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { AuthRequest } from '../types';

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

export async function getReviewById(req: Request, res: Response): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM reviews WHERE id = ?',
    [req.params.id],
  );
  if (rows.length === 0) {
    res.status(404).json({ success: false, error: 'Review not found' });
    return;
  }
  res.json({ success: true, data: formatReview(rows[0] as ReviewRow) });
}

export async function createReview(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { burgerId, rating, comment } = req.body as {
    burgerId: string;
    rating: number;
    comment?: string;
  };

  const [result] = await pool.query(
    'INSERT INTO reviews (user_id, burger_id, rating, comment) VALUES (?, ?, ?, ?)',
    [userId, burgerId, rating, comment ?? null],
  );
  const insertId = (result as { insertId: number }).insertId;

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM reviews WHERE id = ?',
    [insertId],
  );
  res.status(201).json({ success: true, data: formatReview(rows[0] as ReviewRow) });
}
