import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, AuthPayload } from '../types';
import { Errors, AppError } from '../lib/errors';

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(Errors.authTokenMissing());
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(Errors.authTokenExpired());
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(Errors.authTokenInvalid());
    }
    return next(new AppError('AUTH_TOKEN_INVALID', '認証トークンが不正です', 401));
  }
}
