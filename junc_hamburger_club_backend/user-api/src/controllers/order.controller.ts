import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest, OrderRow, OrderItemRow, PickupSettingsRow } from '../types';
import { RowDataPacket } from 'mysql2';
import { settingsFromRow, validatePickupAt } from '../lib/pickup_rules';
import { formatJstIso } from './pickup.controller';

function generateOrderNumber(): string {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `JUNC-${ymd}-${rand}`;
}

function formatOrder(order: OrderRow, items: OrderItemRow[]) {
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
    })),
  };
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
      res.status(500).json({ success: false, error: 'Pickup settings not configured' });
      return;
    }
    const settings = settingsFromRow(settingsRows[0] as PickupSettingsRow);
    const validation = validatePickupAt(pickupAt, settings, new Date());
    if (!validation.ok) {
      res.status(400).json({ success: false, error: 'Invalid pickupAt', code: validation.code });
      return;
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
        res.status(409).json({ success: false, error: 'Pickup slot is full', code: 'pickup_slot_full' });
        return;
      }

      await conn.query(
        'UPDATE pickup_slot_counters SET reserved_count = reserved_count + 1 WHERE store_id = 1 AND slot_at = ?',
        [normalizedPickupAt],
      );
    }

    // Get cart items
    const [cartRows] = await conn.query<RowDataPacket[]>(
      `SELECT ci.*, b.price AS burger_price, b.name AS burger_name
       FROM cart_items ci
       JOIN burgers b ON ci.burger_id = b.id
       WHERE ci.user_id = ? AND b.is_available = 1`,
      [userId]
    );

    if (cartRows.length === 0) {
      await conn.rollback();
      res.status(400).json({ success: false, error: 'Cart is empty' });
      return;
    }

    const subtotal = cartRows.reduce((s, r) => s + parseFloat(r['burger_price']) * r['quantity'], 0);
    const taxAmount = subtotal * 0.1;
    const totalAmount = subtotal + taxAmount;
    const orderNumber = generateOrderNumber();
    const estimatedReadyAt = new Date(Date.now() + 20 * 60 * 1000); // 20 min

    const [orderResult] = await conn.query(
      `INSERT INTO orders (user_id, order_number, status, total_amount, tax_amount, notes, estimated_ready_at, pickup_at)
       VALUES (?, ?, 'received', ?, ?, ?, ?, ?)`,
      [userId, orderNumber, totalAmount.toFixed(2), taxAmount.toFixed(2), notes ?? null, estimatedReadyAt, normalizedPickupAt]
    );
    const orderId = (orderResult as { insertId: number }).insertId;

    for (const item of cartRows) {
      const unitPrice = parseFloat(item['burger_price']);
      await conn.query(
        'INSERT INTO order_items (order_id, burger_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [orderId, item['burger_id'], item['quantity'], unitPrice.toFixed(2), (unitPrice * item['quantity']).toFixed(2)]
      );
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

    res.status(201).json({
      success: true,
      data: formatOrder(orderRows[0] as OrderRow, itemRows as OrderItemRow[]),
    });
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

  const orders = await Promise.all(
    (orderRows as OrderRow[]).map(async (order) => {
      const [itemRows] = await pool.query<RowDataPacket[]>(
        `SELECT oi.*, b.name AS burger_name, b.image_url AS burger_image_url
         FROM order_items oi JOIN burgers b ON oi.burger_id = b.id WHERE oi.order_id = ?`,
        [order.id]
      );
      return formatOrder(order, itemRows as OrderItemRow[]);
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
    res.status(404).json({ success: false, error: 'Order not found' });
    return;
  }

  const [itemRows] = await pool.query<RowDataPacket[]>(
    `SELECT oi.*, b.name AS burger_name, b.image_url AS burger_image_url
     FROM order_items oi JOIN burgers b ON oi.burger_id = b.id WHERE oi.order_id = ?`,
    [orderId]
  );

  res.json({ success: true, data: formatOrder(orderRows[0] as OrderRow, itemRows as OrderItemRow[]) });
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
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    const { status, pickup_at } = rows[0] as { status: string; pickup_at: Date | null };
    if (!['received'].includes(status)) {
      await conn.rollback();
      res.status(400).json({ success: false, error: 'Cannot cancel order in current status' });
      return;
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
