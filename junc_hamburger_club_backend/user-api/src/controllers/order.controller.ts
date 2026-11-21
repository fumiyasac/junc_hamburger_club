import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest, OrderRow, OrderItemRow, PickupSettingsRow } from '../types';
import { RowDataPacket } from 'mysql2';
import { settingsFromRow, validatePickupAt, PICKUP_VALIDATION_MESSAGES } from '../lib/pickup_rules';
import { formatJstIso } from './pickup.controller';
import { AppError, Errors } from '../lib/errors';
import { markIdempotencySucceeded } from '../middleware/idempotency.middleware';

function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `JUNC-${ymd}-${rand}`;
}

interface ItemOptionSnapshot {
  id: string;
  optionId: string | null;
  groupName: string;
  optionName: string;
  priceDelta: number;
}

function formatOrder(
  order: OrderRow,
  items: OrderItemRow[],
  optionsByItemId: Map<number, ItemOptionSnapshot[]>,
) {
  return {
    id: String(order.id),
    orderNumber: order.order_number,
    status: order.status,
    totalAmount: parseFloat(order.total_amount),
    taxAmount: parseFloat(order.tax_amount),
    notes: order.notes,
    estimatedReadyAt: order.estimated_ready_at,
    pickupAt: order.pickup_at ? formatJstIso(order.pickup_at) : null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((i) => ({
      id: String(i.id),
      burgerId: String(i.burger_id),
      burgerName: i.burger_name,
      burgerImageUrl: i.burger_image_url,
      quantity: i.quantity,
      unitPrice: parseFloat(i.unit_price),
      subtotal: parseFloat(i.subtotal),
      options: optionsByItemId.get(i.id) ?? [],
    })),
  };
}

async function loadOrderItemOptions(orderIds: number[]): Promise<Map<number, ItemOptionSnapshot[]>> {
  const map = new Map<number, ItemOptionSnapshot[]>();
  if (orderIds.length === 0) return map;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT oio.id, oio.order_item_id, oio.option_id, oio.group_name, oio.option_name, oio.price_delta
     FROM order_item_options oio
     JOIN order_items oi ON oi.id = oio.order_item_id
     WHERE oi.order_id IN (?)
     ORDER BY oio.id`,
    [orderIds],
  );
  for (const r of rows as RowDataPacket[]) {
    const itemId = r['order_item_id'] as number;
    if (!map.has(itemId)) map.set(itemId, []);
    map.get(itemId)!.push({
      id: String(r['id']),
      optionId: r['option_id'] === null ? null : String(r['option_id']),
      groupName: r['group_name'] as string,
      optionName: r['option_name'] as string,
      priceDelta: parseFloat(r['price_delta'] as string),
    });
  }
  return map;
}

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { notes, pickupAt } = req.body as { notes?: string; pickupAt?: string };

  // ─── pickupAt 検証 (DB 接続前にできるものは先に) ────────────────
  let normalizedPickupAt: Date | null = null;

  if (pickupAt) {
    const [settingsRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM pickup_settings WHERE store_id = 1',
    );
    if (settingsRows.length === 0) {
      throw new AppError('APP_CONFIG_NOT_FOUND', '受け取り枠設定が初期化されていません', 500);
    }
    const settings = settingsFromRow(settingsRows[0] as PickupSettingsRow);
    const validation = validatePickupAt(pickupAt, settings, new Date());
    if (!validation.ok) {
      const details: Record<string, unknown> = {};
      if (validation.code === 'PICKUP_BOUNDARY') details.slotIntervalMin = settings.slotIntervalMin;
      if (validation.code === 'PICKUP_OUT_OF_HOURS') {
        details.openTime = settings.openTime;
        details.closeTime = settings.closeTime;
      }
      if (validation.code === 'PICKUP_LEAD_TIME') details.leadTimeMin = settings.leadTimeMin;
      throw new AppError(validation.code, PICKUP_VALIDATION_MESSAGES[validation.code], 400,
        Object.keys(details).length ? details : undefined);
    }
    normalizedPickupAt = validation.pickupAt;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ─── 枠カウンタのロック取得 (pickupAt 指定時のみ) ───────────────
    if (normalizedPickupAt) {
      // UPSERT で行を作り、FOR UPDATE で改めて取得する
      await conn.query(
        `INSERT INTO pickup_slot_counters (store_id, slot_at, reserved_count)
         VALUES (1, ?, 0)
         ON DUPLICATE KEY UPDATE store_id = store_id`,
        [normalizedPickupAt],
      );
      const [counterRows] = await conn.query<RowDataPacket[]>(
        'SELECT reserved_count FROM pickup_slot_counters WHERE store_id = 1 AND slot_at = ? FOR UPDATE',
        [normalizedPickupAt],
      );
      const reserved = (counterRows[0] as { reserved_count: number }).reserved_count;

      const [capacityRows] = await conn.query<RowDataPacket[]>(
        'SELECT slot_capacity FROM pickup_settings WHERE store_id = 1',
      );
      const capacity = (capacityRows[0] as { slot_capacity: number }).slot_capacity;

      if (reserved >= capacity) {
        await conn.rollback();
        throw new AppError('PICKUP_SLOT_FULL', 'この時間帯は予約がいっぱいです', 409,
          { slotAt: formatJstIso(normalizedPickupAt) });
      }

      await conn.query(
        'UPDATE pickup_slot_counters SET reserved_count = reserved_count + 1 WHERE store_id = 1 AND slot_at = ?',
        [normalizedPickupAt],
      );
    }

    // Get cart items (incl. options via LEFT JOIN of cart_item_options)
    const [cartRows] = await conn.query<RowDataPacket[]>(
      `SELECT ci.id, ci.burger_id, ci.quantity,
              b.price AS burger_price, b.name AS burger_name
       FROM cart_items ci
       JOIN burgers b ON ci.burger_id = b.id
       WHERE ci.user_id = ? AND b.is_available = 1`,
      [userId]
    );

    if (cartRows.length === 0) {
      await conn.rollback();
      throw Errors.cartEmpty();
    }

    const cartIds = cartRows.map((r) => r['id'] as number);
    const [optRows] = await conn.query<RowDataPacket[]>(
      `SELECT cio.cart_item_id, o.id, o.name, o.price_delta, o.is_available, og.name AS group_name
       FROM cart_item_options cio
       JOIN options o ON o.id = cio.option_id
       JOIN option_groups og ON og.id = o.group_id
       WHERE cio.cart_item_id IN (?)
       FOR SHARE`,
      [cartIds],
    );

    // cart_item_id -> options
    interface CartOption {
      id: number;
      name: string;
      priceDelta: number;
      isAvailable: boolean;
      groupName: string;
    }
    const optsByCart = new Map<number, CartOption[]>();
    for (const r of optRows as RowDataPacket[]) {
      const cid = r['cart_item_id'] as number;
      if (!optsByCart.has(cid)) optsByCart.set(cid, []);
      optsByCart.get(cid)!.push({
        id: r['id'] as number,
        name: r['name'] as string,
        priceDelta: parseFloat(r['price_delta'] as string),
        isAvailable: Boolean(r['is_available']),
        groupName: r['group_name'] as string,
      });
    }

    // 売り切れ再検証
    for (const item of cartRows) {
      const opts = optsByCart.get(item['id'] as number) ?? [];
      const sold = opts.find((o) => !o.isAvailable);
      if (sold) {
        await conn.rollback();
        throw new AppError('OPTION_OUT_OF_STOCK_AT_ORDER', 'カート内オプションが売り切れになりました', 400, {
          itemId: String(item['id']),
          optionId: String(sold.id),
          optionName: sold.name,
        });
      }
    }

    // 価格計算 (unit_price はオプション差分込み)
    const itemCalc = cartRows.map((item) => {
      const opts = optsByCart.get(item['id'] as number) ?? [];
      const base = parseFloat(item['burger_price'] as string);
      const delta = opts.reduce((s, o) => s + o.priceDelta, 0);
      const unitPrice = base + delta;
      return { item, opts, unitPrice, subtotal: unitPrice * (item['quantity'] as number) };
    });

    const subtotal = itemCalc.reduce((s, c) => s + c.subtotal, 0);
    // 税は整数円に丸め、プレビュー (order_pricing.ts) と一致させる
    const taxAmount = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + taxAmount;
    const orderNumber = generateOrderNumber();
    const estimatedReadyAt = new Date(Date.now() + 20 * 60 * 1000);

    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, order_number, status, total_amount, tax_amount, notes, estimated_ready_at, pickup_at)
       VALUES (?, ?, 'received', ?, ?, ?, ?, ?)`,
      [userId, orderNumber, totalAmount.toFixed(2), taxAmount.toFixed(2), notes ?? null, estimatedReadyAt, normalizedPickupAt]
    );
    const orderId = (orderResult as { insertId: number }).insertId;

    for (const c of itemCalc) {
      const [oiResult] = await conn.query(
        'INSERT INTO order_items (order_id, burger_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [orderId, c.item['burger_id'], c.item['quantity'], c.unitPrice.toFixed(2), c.subtotal.toFixed(2)]
      );
      const orderItemId = (oiResult as { insertId: number }).insertId;

      // snapshot
      for (const o of c.opts) {
        await conn.query(
          `INSERT INTO order_item_options (order_item_id, option_id, group_name, option_name, price_delta)
           VALUES (?, ?, ?, ?, ?)`,
          [orderItemId, o.id, o.groupName, o.name, o.priceDelta.toFixed(2)],
        );
      }
    }

    await conn.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
    await conn.commit();

    const [orderRows] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );
    const [itemRows] = await conn.query<RowDataPacket[]>(
      `SELECT oi.*, b.name AS burger_name, b.image_url AS burger_image_url
       FROM order_items oi JOIN burgers b ON oi.burger_id = b.id WHERE oi.order_id = ?`,
      [orderId]
    );
    const optionsByItemId = await loadOrderItemOptions([orderId]);

    const payload = {
      success: true,
      data: formatOrder(orderRows[0] as OrderRow, itemRows as OrderItemRow[], optionsByItemId),
    };

    // Idempotency-Key 使用時はレスポンスを保存 (同キー再送で再生される)
    if (req.idempotency) {
      await markIdempotencySucceeded(userId, req.idempotency, orderId, 201, payload);
    }

    res.status(201).json(payload);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getOrders(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const [orderRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    [userId]
  );
  const orderIds = (orderRows as OrderRow[]).map((o) => o.id);
  const optionsByItemId = await loadOrderItemOptions(orderIds);

  const orders = await Promise.all(
    (orderRows as OrderRow[]).map(async (order) => {
      const [itemRows] = await pool.query<RowDataPacket[]>(
        `SELECT oi.*, b.name AS burger_name, b.image_url AS burger_image_url
         FROM order_items oi JOIN burgers b ON oi.burger_id = b.id WHERE oi.order_id = ?`,
        [order.id]
      );
      return formatOrder(order, itemRows as OrderItemRow[], optionsByItemId);
    })
  );

  res.json({ success: true, data: orders });
}

export async function getOrderById(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { orderId } = req.params;

  const [orderRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM orders WHERE id = ? AND user_id = ?',
    [orderId, userId]
  );

  if (orderRows.length === 0) {
    throw Errors.orderNotFound(orderId);
  }

  const [itemRows] = await pool.query<RowDataPacket[]>(
    `SELECT oi.*, b.name AS burger_name, b.image_url AS burger_image_url
     FROM order_items oi JOIN burgers b ON oi.burger_id = b.id WHERE oi.order_id = ?`,
    [orderId]
  );
  const optionsByItemId = await loadOrderItemOptions([Number(orderId)]);

  res.json({ success: true, data: formatOrder(orderRows[0] as OrderRow, itemRows as OrderItemRow[], optionsByItemId) });
}

export async function cancelOrder(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { orderId } = req.params;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT status, pickup_at FROM orders WHERE id = ? AND user_id = ? FOR UPDATE",
      [orderId, userId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      throw Errors.orderNotFound(orderId);
    }

    const { status, pickup_at } = rows[0] as { status: string; pickup_at: Date | null };
    if (!['received'].includes(status)) {
      await conn.rollback();
      throw Errors.orderCancelNotAllowed(status);
    }

    await conn.query(
      "UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [orderId]
    );

    // 枠カウンタの減算 (pickup_at があるキャンセルのみ)
    if (pickup_at) {
      await conn.query(
        'UPDATE pickup_slot_counters SET reserved_count = GREATEST(reserved_count - 1, 0) WHERE store_id = 1 AND slot_at = ?',
        [pickup_at],
      );
    }

    await conn.commit();
    res.json({ success: true, message: 'Order cancelled' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── プレビュー: 注文を作らずに明細と可否を返す ───────────────────────
// 実装は order_pricing.ts に委譲
export async function previewOrder(req: AuthRequest, res: Response): Promise<void> {
  const { computePreview } = await import('../lib/order_pricing');
  const userId = req.user!.userId;
  const { pickupAt } = req.body as { pickupAt?: string };
  const data = await computePreview(userId, pickupAt);
  res.json({ success: true, data });
}
