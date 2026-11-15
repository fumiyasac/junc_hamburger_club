import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { NewsCategory, NewsRow } from '../types';

// カテゴリーのコード値 (ENUM の代わりに controller / spec / client で共有する唯一の source)
export const NEWS_CATEGORIES: readonly NewsCategory[] = ['store', 'menu', 'campaign', 'app'] as const;

// 一覧用の抜粋は改行を半角スペースに畳んで 120 文字で切る。
// モバイルで一覧を表示する際、本文を全部転送しなくて済むように。
function makeExcerpt(body: string, max = 120): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max) + '…';
}

function formatNewsListItem(row: NewsRow) {
  return {
    id: String(row.id),
    title: row.title,
    category: row.category,
    excerpt: makeExcerpt(row.body),
    publishedAt: row.published_at,
  };
}

function formatNewsDetail(row: NewsRow) {
  return {
    id: String(row.id),
    title: row.title,
    category: row.category,
    body: row.body,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getNewsList(req: Request, res: Response): Promise<void> {
  // page / limit / category のバリデーションは routes 側の express-validator
  // + validate middleware で済んでいる (不正値は 400 で弾かれる)。
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const offset = (page - 1) * limit;

  // 未来日時 (予約公開) は一覧から除外
  let where = 'WHERE published_at <= CURRENT_TIMESTAMP';
  const params: unknown[] = [];

  const category = req.query.category as string | undefined;
  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM news ${where}`,
    params,
  );
  const total = (countRows[0] as { total: number }).total;

  params.push(limit, offset);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, category, body, published_at, created_at, updated_at
     FROM news ${where}
     ORDER BY published_at DESC
     LIMIT ? OFFSET ?`,
    params,
  );

  res.json({
    success: true,
    data: {
      news: (rows as NewsRow[]).map(formatNewsListItem),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    },
  });
}

export async function getNewsCategories(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: NEWS_CATEGORIES });
}

export async function getNewsById(req: Request, res: Response): Promise<void> {
  // 未来日時のお知らせは詳細でも返さない
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, title, category, body, published_at, created_at, updated_at
     FROM news
     WHERE id = ? AND published_at <= CURRENT_TIMESTAMP`,
    [req.params.id],
  );

  if (rows.length === 0) {
    res.status(404).json({ success: false, error: 'News not found' });
    return;
  }

  res.json({ success: true, data: formatNewsDetail(rows[0] as NewsRow) });
}
