import { Request, Response } from 'express';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { BurgerRow } from '../types';

const BURGER_SELECT = `
  SELECT
    b.*,
    bc.name  AS category_name,
    bc.emoji AS category_emoji,
    (SELECT GROUP_CONCAT(bi.ingredient ORDER BY bi.display_order SEPARATOR '|||')
     FROM burger_ingredients bi WHERE bi.burger_id = b.id) AS ingredients,
    (SELECT GROUP_CONCAT(bt.tag SEPARATOR ',')
     FROM burger_tags bt WHERE bt.burger_id = b.id) AS tags
  FROM burgers b
  JOIN burger_categories bc ON b.category_id = bc.id
`;

function formatBurger(row: BurgerRow) {
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    categoryName: row.category_name,
    categoryEmoji: row.category_emoji,
    name: row.name,
    description: row.description,
    price: parseFloat(row.price),
    imageUrl: row.image_url,
    rating: parseFloat(row.rating),
    reviewCount: row.review_count,
    isPopular: Boolean(row.is_popular),
    isAvailable: Boolean(row.is_available),
    calories: row.calories,
    ingredients: row.ingredients ? row.ingredients.split('|||') : [],
    tags: row.tags ? row.tags.split(',') : [],
  };
}

export async function getBurgers(req: Request, res: Response): Promise<void> {
  const { category, popular, search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = 'WHERE b.is_available = 1';
  const params: unknown[] = [];

  if (category) {
    where += ' AND b.category_id = ?';
    params.push(category);
  }
  if (popular === 'true') {
    where += ' AND b.is_popular = 1';
  }
  if (search) {
    where += ' AND (b.name LIKE ? OR b.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM burgers b JOIN burger_categories bc ON b.category_id = bc.id ${where}`,
    params
  );
  const total = (countRows[0] as { total: number }).total;

  params.push(Number(limit), offset);
  const [rows] = await pool.query<RowDataPacket[]>(
    `${BURGER_SELECT} ${where} ORDER BY b.is_popular DESC, b.rating DESC LIMIT ? OFFSET ?`,
    params
  );

  res.json({
    success: true,
    data: {
      burgers: (rows as BurgerRow[]).map(formatBurger),
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    },
  });
}

export async function getBurgerById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const [rows] = await pool.query<RowDataPacket[]>(
    `${BURGER_SELECT} WHERE b.id = ? AND b.is_available = 1`,
    [id]
  );

  if (rows.length === 0) {
    res.status(404).json({ success: false, error: 'Burger not found' });
    return;
  }

  // 詳細のみ optionGroups を含める (一覧は含めない)
  const [groupRows] = await pool.query<RowDataPacket[]>(
    `SELECT og.id, og.name, og.is_required, og.min_select, og.max_select, bog.display_order
     FROM burger_option_groups bog
     JOIN option_groups og ON og.id = bog.group_id
     WHERE bog.burger_id = ?
     ORDER BY bog.display_order, og.id`,
    [id],
  );
  const groupIds = groupRows.map((r) => r['id'] as number);
  const [optionRows] = groupIds.length > 0
    ? await pool.query<RowDataPacket[]>(
        `SELECT id, group_id, name, price_delta, is_available, display_order
         FROM options
         WHERE group_id IN (?)
         ORDER BY display_order, id`,
        [groupIds],
      )
    : [[]];

  const optionsByGroup = new Map<number, Array<Record<string, unknown>>>();
  for (const o of optionRows as RowDataPacket[]) {
    const gid = o['group_id'] as number;
    if (!optionsByGroup.has(gid)) optionsByGroup.set(gid, []);
    optionsByGroup.get(gid)!.push({
      id: String(o['id']),
      name: o['name'],
      priceDelta: parseFloat(o['price_delta']),
      isAvailable: Boolean(o['is_available']),
      displayOrder: o['display_order'],
    });
  }

  const optionGroups = (groupRows as RowDataPacket[]).map((g) => ({
    id: String(g['id']),
    name: g['name'],
    isRequired: Boolean(g['is_required']),
    minSelect: g['min_select'],
    maxSelect: g['max_select'],
    displayOrder: g['display_order'],
    options: optionsByGroup.get(g['id'] as number) ?? [],
  }));

  res.json({
    success: true,
    data: { ...formatBurger(rows[0] as BurgerRow), optionGroups },
  });
}

export async function getCategories(_req: Request, res: Response): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM burger_categories WHERE is_active = 1 ORDER BY display_order'
  );

  res.json({
    success: true,
    data: rows.map((r) => ({
      id: String(r['id']),
      name: r['name'],
      emoji: r['emoji'],
      description: r['description'],
      displayOrder: r['display_order'],
    })),
  });
}

export async function searchBurgers(req: Request, res: Response): Promise<void> {
  const { q } = req.query;
  if (!q || String(q).trim().length === 0) {
    res.json({ success: true, data: [] });
    return;
  }

  const keyword = `%${q}%`;
  const [rows] = await pool.query<RowDataPacket[]>(
    `${BURGER_SELECT}
     WHERE b.is_available = 1
       AND (b.name LIKE ? OR b.description LIKE ?
            OR bc.name LIKE ?
            OR EXISTS (SELECT 1 FROM burger_tags bt WHERE bt.burger_id = b.id AND bt.tag LIKE ?))
     ORDER BY b.is_popular DESC, b.rating DESC
     LIMIT 30`,
    [keyword, keyword, keyword, keyword]
  );

  res.json({ success: true, data: (rows as BurgerRow[]).map(formatBurger) });
}
