// 認証系エンドポイントのレートリミット (IP ベース、インメモリ)。
// 複数インスタンス運用時は Redis store に差し替える想定。
//
// 429 + RATE_LIMIT_EXCEEDED code を返す。

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

interface Bucket {
  count: number;
  windowStart: number;
}

type KeyFn = (req: Request) => string;

function makeLimiter(opts: { windowMs: number; max: number; keyPrefix: string; keyFn?: KeyFn }) {
  const buckets = new Map<string, Bucket>();

  // メモリリーク防止: 期限切れバケットを 5 分ごとに掃除
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets.entries()) {
      if (now - b.windowStart >= opts.windowMs * 2) buckets.delete(k);
    }
  }, 5 * 60 * 1000).unref();

  return function (req: Request, _res: Response, next: NextFunction) {
    const inner = opts.keyFn ? opts.keyFn(req) : (req.ip ?? req.socket.remoteAddress ?? 'unknown');
    const key = `${opts.keyPrefix}:${inner}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart >= opts.windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > opts.max) {
      const retryAfterSeconds = Math.ceil((bucket.windowStart + opts.windowMs - now) / 1000);
      return next(new AppError(
        'RATE_LIMIT_EXCEEDED',
        'リクエストが多すぎます。しばらくしてから再試行してください',
        429,
        { retryAfterSeconds },
      ));
    }
    next();
  };
}

// login/register は "email + IP" をキーに。CGNAT 配下で正常ユーザーが巻き込まれるのを防ぐ。
// email が無い場合は IP だけ (登録時の validate 前通過)。
const loginKey: KeyFn = (req) => {
  const email = (req.body?.email ?? '').toString().toLowerCase().trim();
  return `${email}|${req.ip ?? 'unknown'}`;
};

export const loginRateLimit = makeLimiter({ windowMs: 60_000, max: 5, keyPrefix: 'login', keyFn: loginKey });
export const refreshRateLimit = makeLimiter({ windowMs: 60_000, max: 20, keyPrefix: 'refresh' });
