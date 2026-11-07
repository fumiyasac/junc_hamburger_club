import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { AuthRequest, UserRow } from '../types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, email, profile_image_url, created_at FROM users WHERE id = ? AND is_active = 1',
    [userId]
  );

  if (rows.length === 0) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const user = rows[0] as UserRow;
  res.json({
    success: true,
    data: {
      id: String(user.id),
      name: user.name,
      email: user.email,
      profileImageUrl: user.profile_image_url,
      createdAt: user.created_at,
    },
  });
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { name, profileImageUrl } = req.body as { name?: string; profileImageUrl?: string };

  const fields: string[] = [];
  const params: unknown[] = [];

  if (name) { fields.push('name = ?'); params.push(name); }
  if (profileImageUrl !== undefined) { fields.push('profile_image_url = ?'); params.push(profileImageUrl); }

  if (fields.length === 0) {
    res.status(400).json({ success: false, error: 'No fields to update' });
    return;
  }

  params.push(userId);
  await pool.query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    params
  );

  // 更新後の user を返却 (クライアント側で再フェッチ不要にする)
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, email, profile_image_url, created_at FROM users WHERE id = ?',
    [userId]
  );
  const user = rows[0] as UserRow;
  res.json({
    success: true,
    data: {
      id: String(user.id),
      name: user.name,
      email: user.email,
      profileImageUrl: user.profile_image_url,
      createdAt: user.created_at,
    },
  });
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT password_hash FROM users WHERE id = ?',
    [userId]
  );

  const user = rows[0] as { password_hash: string } | undefined;
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    res.status(401).json({ success: false, error: 'Current password is incorrect' });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newHash, userId]
  );

  res.json({ success: true, message: 'Password changed' });
}

export async function deleteAccount(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [userId]
  );

  if (result.affectedRows === 0) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  res.json({ success: true, message: 'Account deactivated' });
}
