import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest, CartItemRow } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

function formatCartItem(row: CartItemRow) {
  return {
    id: String(row.id),
    burgerId: String(row.burger_id),
    burgerName: row.burger_name,
    burgerPrice: parseFloat(row.burger_price),
    burgerImageUrl: row.burger_image_url,
    quantity: row.quantity,
    subtotal: parseFloat(row.burger_price) * row.quantity,
  };
}

export async function getCart(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ci.*, b.name AS burger_name, b.price AS burger_price,
            b.image_url AS burger_image_url, b.is_available AS burger_is_available
     FROM cart_items ci
     JOIN burgers b ON ci.burger_id = b.id
     WHERE ci.user_id = ?
     ORDER BY ci.created_at DESC`,
    [userId]
  );

  const items = (rows as CartItemRow[]).map(formatCartItem);
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

  res.json({
    success: true,
    data: { items, subtotal, tax: subtotal * 0.1, total: subtotal * 1.1 },
  });
}

export async function addToCart(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { burgerId, quantity = 1 } = req.body as { burgerId: string; quantity: number };

  const [burgers] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM burgers WHERE id = ? AND is_available = 1',
    [burgerId]
  );
  if (burgers.length === 0) {
    res.status(404).json({ success: false, error: 'Burger not found or unavailable' });
    return;
  }

  await pool.query(
    `INSERT INTO cart_items (user_id, burger_id, quantity) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = CURRENT_TIMESTAMP`,
    [userId, burgerId, quantity]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ci.*, b.name AS burger_name, b.price AS burger_price,
            b.image_url AS burger_image_url, b.is_available AS burger_is_available
     FROM cart_items ci
     JOIN burgers b ON ci.burger_id = b.id
     WHERE ci.user_id = ? AND ci.burger_id = ?`,
    [userId, burgerId]
  );

  res.status(201).json({ success: true, data: formatCartItem(rows[0] as CartItemRow) });
}

export async function updateCartItem(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { itemId } = req.params;
  const { quantity } = req.body as { quantity: number };

  if (quantity <= 0) {
    await pool.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [itemId, userId]);
    res.json({ success: true, message: 'Item removed' });
    return;
  }

  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [quantity, itemId, userId]
  );

  if (result.affectedRows === 0) {
    res.status(404).json({ success: false, error: 'Cart item not found' });
    return;
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
