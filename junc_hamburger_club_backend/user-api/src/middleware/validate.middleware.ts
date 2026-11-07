import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// express-validator の検証結果を走査し、エラーがあれば 400 を返す共通ミドルウェア。
// 各ルート定義で validator チェーンの直後に挟む。
export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((e) => ({
        field: 'path' in e ? e.path : undefined,
        message: e.msg,
      })),
    });
    return;
  }
  next();
}
