import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, AuthPayload } from '../types';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authorization token required' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}
