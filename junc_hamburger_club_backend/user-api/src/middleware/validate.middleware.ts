import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../lib/errors';

// express-validator の検証結果を走査し、エラーがあれば VALIDATION_FAILED で 400 を返す。
export function validate(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const issues = errors.array().map((e) => ({
      field: 'path' in e && typeof e.path === 'string' ? e.path : '',
      message: typeof e.msg === 'string' ? e.msg : String(e.msg),
    }));
    return next(new AppError('VALIDATION_FAILED', '入力値が不正です', 400, { issues }));
  }
  next();
}
