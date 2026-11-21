import { Request, Response, NextFunction } from 'express';
import { AppError, errorPayload } from '../lib/errors';
import { AuthRequest } from '../types';
import { markIdempotencyFailed } from './idempotency.middleware';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Idempotency PENDING 行の cleanup (エラー時は行を削除して再試行可能にする)。
  // ただし「同じキーで異なる body」と「同キー処理中」を返した場合は
  // すでに別の tx が走っているので削除しない。
  const authReq = req as AuthRequest;
  const ctx = authReq.idempotency;
  const isIdempotencyAppError =
    err instanceof AppError &&
    (err.code === 'ORDER_IDEMPOTENCY_CONFLICT' || err.code === 'ORDER_IDEMPOTENCY_IN_PROGRESS');
  if (ctx && authReq.user && !isIdempotencyAppError) {
    markIdempotencyFailed(authReq.user.userId, ctx).catch((e) =>
      console.error('markIdempotencyFailed failed:', e),
    );
  }

  if (err instanceof AppError) {
    res.status(err.httpStatus).json(errorPayload(err.code, err.message, err.details));
    return;
  }
  console.error('Unhandled error:', err);
  const message = process.env.NODE_ENV === 'production'
    ? 'サーバー内部エラーが発生しました'
    : err.message;
  res.status(500).json(errorPayload('INTERNAL_ERROR', message));
}
