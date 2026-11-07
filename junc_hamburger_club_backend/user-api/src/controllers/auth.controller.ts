import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { UserRow } from '../types';
import { RowDataPacket } from 'mysql2';

const JWT_SECRET = process.env.JWT_SECRET ?? 'secret';
const JWT_EXPIRES_IN = '7d';

function signToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body as { name: string; email: string; password: string };

  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  if (existing.length > 0) {
    res.status(409).json({ success: false, error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [name, email, passwordHash]
  );
  const userId = (result as { insertId: number }).insertId;

  const token = signToken(userId, email);
  res.status(201).json({
    success: true,
    data: {
      token,
      user: {
        id: String(userId),
        name,
        email,
        profileImageUrl: null,
        createdAt: new Date().toISOString(),
      },
    },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM users WHERE email = ? AND is_active = 1',
    [email]
  );
  const user = rows[0] as UserRow | undefined;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ success: false, error: 'Invalid email or password' });
    return;
  }

  const token = signToken(user.id, user.email);
  res.json({
    success: true,
    data: {
      token,
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
        profileImageUrl: user.profile_image_url,
        createdAt: user.created_at,
      },
    },
  });
}
