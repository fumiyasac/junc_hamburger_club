import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  computeOptionHash,
  computeUnitPrice,
  OptionDef,
  OptionGroupDef,
  validateOptionSelection,
  VALIDATION_MESSAGES,
} from '../lib/options';
import { AppError, Errors } from '../lib/errors';

// ─── ヘルパー: cart item + options + price を組み立てる ───────────────

interface CartItemWithOptions {
  id: string;
  burgerId: string;
  burgerName: string;
  burgerPrice: number;
  burgerImageUrl: string | null;
  quantity: number;
  options: Array<{ id: string; groupName: string; name: string; priceDelta: number }>;
  unitPrice: number;
  subtotal: number;
}

async function loadCartWithOptions(userId: number): Promise<CartItemWithOptions[]> {
  const [cartRows] = await pool.query<RowDataPacket[]>(
    `SELECT ci.id, ci.burger_id, ci.quantity, ci.option_hash,
            b.name AS burger_name, b.price AS burger_price, b.image_url AS burger_image_url
     FROM cart_items ci
     JOIN burgers b ON ci.burger_id = b.id
     WHERE ci.user_id = ?
     ORDER BY ci.created_at DESC`,
    [userId],
  );
  if (cartRows.length === 0) return [];

  const cartIds = cartRows.map((r) => r['id'] as number);
  const [optRows] = await pool.query<RowDataPacket[]>(
    `SELECT cio.cart_item_id, o.id, o.name, o.price_delta, og.name AS group_name
     FROM cart_item_options cio
     JOIN options o ON o.id = cio.option_id
     JOIN option_groups og ON og.id = o.group_id
     WHERE cio.cart_item_id IN (?)
     ORDER BY og.display_order, o.display_order, o.id`,
    [cartIds],
  );

  const optsByCart = new Map<number, Array<{ id: string; groupName: string; name: string; priceDelta: number }>>();
  for (const r of optRows as RowDataPacket[]) {
    const cid = r['cart_item_id'] as number;
    if (!optsByCart.has(cid)) optsByCart.set(cid, []);
    optsByCart.get(cid)!.push({
      id: String(r['id']),
      groupName: r['group_name'] as string,
      name: r['name'] as string,
      priceDelta: parseFloat(r['price_delta'] as string),
    });
  }

  return (cartRows as RowDataPacket[]).map((r) => {
    const opts = optsByCart.get(r['id'] as number) ?? [];
    const burgerPrice = parseFloat(r['burger_price'] as string);
    const unitPrice = burgerPrice + opts.reduce((s, o) => s + o.priceDelta, 0);
    const quantity = r['quantity'] as number;
    return {
      id: String(r['id']),
      burgerId: String(r['burger_id']),
      burgerName: r['burger_name'] as string,
      burgerPrice,
      burgerImageUrl: r['burger_image_url'] as string | null,
      quantity,
      options: opts,
      unitPrice,
      subtotal: unitPrice * quantity,
    };
  });
}

export async function getCart(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const items = await loadCartWithOptions(userId);
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  res.json({
    success: true,
    data: (() => {
      const tax = Math.round(subtotal * 0.1);
      return { items, subtotal, tax, total: subtotal + tax };
    })(),
  });
}

export async function addToCart(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { burgerId, quantity = 1, selectedOptionIds = [] } = req.body as {
    burgerId: string;
    quantity?: number;
    selectedOptionIds?: Array<string | number>;
  };

  // バーガー存在
  const [burgerRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, price FROM burgers WHERE id = ? AND is_available = 1',
    [burgerId],
  );
  if (burgerRows.length === 0) {
    throw new AppError('BURGER_UNAVAILABLE', 'このバーガーは現在販売されていません', 400, { burgerId: String(burgerId) });
  }

  // バーガーに適用されるグループ ID
  const [bogRows] = await pool.query<RowDataPacket[]>(
    'SELECT group_id FROM burger_option_groups WHERE burger_id = ?',
    [burgerId],
  );
  const allowedGroupIds = new Set((bogRows as RowDataPacket[]).map((r) => r['group_id'] as number));

  // グループとオプションのマスタをロード
  const [groupRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, is_required, min_select, max_select FROM option_groups',
  );
  const allGroups = new Map<number, OptionGroupDef>();
  for (const g of groupRows as RowDataPacket[]) {
    allGroups.set(g['id'] as number, {
      id: g['id'] as number,
      name: g['name'] as string,
      isRequired: Boolean(g['is_required']),
      minSelect: g['min_select'] as number,
      maxSelect: g['max_select'] as number,
    });
  }

  const [optionRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, group_id, name, price_delta, is_available FROM options',
  );
  const allOptions = new Map<number, OptionDef>();
  for (const o of optionRows as RowDataPacket[]) {
    allOptions.set(o['id'] as number, {
      id: o['id'] as number,
      groupId: o['group_id'] as number,
      name: o['name'] as string,
      priceDelta: parseFloat(o['price_delta'] as string),
      isAvailable: Boolean(o['is_available']),
    });
  }

  const idNums = (selectedOptionIds as Array<string | number>).map((x) => Number(x));

  // 検証
  const result = validateOptionSelection({
    selectedIds: idNums,
    allowedGroupIds,
    allOptions,
    allGroups,
  });
  if (!result.ok) {
    throw new AppError(result.code, VALIDATION_MESSAGES[result.code], 400, result.details);
  }

  const uniqueIds = result.uniqueOptionIds;
  const optionHash = computeOptionHash(uniqueIds);

  // tx: UPSERT cart_item + 中間テーブル挿入
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO cart_items (user_id, burger_id, option_hash, quantity)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity),
                               updated_at = CURRENT_TIMESTAMP`,
      [userId, burgerId, optionHash, quantity],
    );

    const [itemRows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM cart_items WHERE user_id = ? AND burger_id = ? AND option_hash = ?',
      [userId, burgerId, optionHash],
    );
    const cartItemId = (itemRows[0] as { id: number }).id;

    // 既存の cart_item_options は INSERT IGNORE で冪等保持 (新規作成時のみ実質 INSERT)
    for (const oid of uniqueIds) {
      await conn.query(
        'INSERT IGNORE INTO cart_item_options (cart_item_id, option_id) VALUES (?, ?)',
        [cartItemId, oid],
      );
    }

    await conn.commit();

    const items = await loadCartWithOptions(userId);
    const target = items.find((i) => i.id === String(cartItemId));
    res.status(201).json({ success: true, data: target });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateCartItem(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { itemId } = req.params;
  const { quantity, selectedOptionIds } = req.body as { quantity: number; selectedOptionIds?: unknown };

  // オプション変更は非対応 (docs/options_rules.md §5)
  if (selectedOptionIds !== undefined) {
    throw Errors.cartItemOptionsImmutable();
  }

  if (quantity <= 0) {
    await pool.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [itemId, userId]);
    res.json({ success: true, message: 'Item removed' });
    return;
  }

  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [quantity, itemId, userId],
  );
  if (result.affectedRows === 0) {
    throw Errors.cartItemNotFound(itemId);
  }
  res.json({ success: true, message: 'Cart updated' });
}

export async function removeFromCart(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { itemId } = req.params;
  await pool.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [itemId, userId]);
  res.json({ success: true, message: 'Item removed from cart' });
}

export async function clearCart(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  await pool.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
  res.json({ success: true, message: 'Cart cleared' });
}
