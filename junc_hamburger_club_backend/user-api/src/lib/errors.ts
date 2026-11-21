// 統一エラーレスポンス形式のヘルパ
// 詳細は docs/error_codes.md 参照

import { Request, Response, NextFunction, RequestHandler } from 'express';

export type ErrorCode =
  // 共通
  | 'VALIDATION_FAILED' | 'RESOURCE_NOT_FOUND' | 'INTERNAL_ERROR'
  // 認証
  | 'AUTH_TOKEN_MISSING' | 'AUTH_TOKEN_EXPIRED' | 'AUTH_TOKEN_INVALID'
  | 'AUTH_USER_INACTIVE' | 'AUTH_FORBIDDEN'
  // ユーザー
  | 'USER_EMAIL_IN_USE' | 'USER_LOGIN_FAILED' | 'USER_PASSWORD_CURRENT_INVALID'
  // カート
  | 'CART_EMPTY' | 'CART_ITEM_NOT_FOUND' | 'CART_ITEM_OPTIONS_IMMUTABLE'
  // バーガー
  | 'BURGER_NOT_FOUND' | 'BURGER_UNAVAILABLE'
  // 受け取り枠
  | 'PICKUP_INVALID_FORMAT' | 'PICKUP_BOUNDARY' | 'PICKUP_CLOSED_DAY'
  | 'PICKUP_PAST_LOOKAHEAD' | 'PICKUP_OUT_OF_HOURS' | 'PICKUP_LEAD_TIME'
  | 'PICKUP_SLOT_FULL'
  // オプション
  | 'OPTION_NOT_FOUND' | 'OPTION_INVALID_BURGER' | 'OPTION_GROUP_REQUIRED'
  | 'OPTION_GROUP_MIN_VIOLATION' | 'OPTION_GROUP_MAX_VIOLATION'
  | 'OPTION_OUT_OF_STOCK' | 'OPTION_OUT_OF_STOCK_AT_ORDER'
  // 注文
  | 'ORDER_NOT_FOUND' | 'ORDER_INVALID_STATUS_TRANSITION' | 'ORDER_CANCEL_NOT_ALLOWED'
  | 'ORDER_IDEMPOTENCY_IN_PROGRESS' | 'ORDER_IDEMPOTENCY_CONFLICT'
  // アプリ設定
  | 'APP_CONFIG_NOT_FOUND' | 'STORE_PROFILE_MISSING';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, httpStatus: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    this.name = 'AppError';
  }
}

// エラーレスポンスの統一形
export function errorPayload(code: ErrorCode, message: string, details?: Record<string, unknown>) {
  const error: { code: ErrorCode; message: string; details?: Record<string, unknown> } = { code, message };
  if (details !== undefined) error.details = details;
  return { success: false as const, error };
}

export function sendError(res: Response, err: AppError): void {
  res.status(err.httpStatus).json(errorPayload(err.code, err.message, err.details));
}

// Express 4 は async エラーを自動 forward しないので handler を包む。
// 使用: `router.get('/', wrapAsync(getXxx))`
export function wrapAsync<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => Promise.resolve(fn(req as T, res, next)).catch(next);
}

// 事前定義 (使用頻度の高いもの)
export const Errors = {
  // 認証
  authTokenMissing: () => new AppError('AUTH_TOKEN_MISSING', '認証情報が見つかりません', 401),
  authTokenExpired: () => new AppError('AUTH_TOKEN_EXPIRED', 'トークンの有効期限が切れています', 401),
  authTokenInvalid: () => new AppError('AUTH_TOKEN_INVALID', '認証トークンが不正です', 401),
  authUserInactive: () => new AppError('AUTH_USER_INACTIVE', 'アカウントが無効化されています', 401),

  // 汎用
  resourceNotFound: (resourceType: string, resourceId: string | number) =>
    new AppError('RESOURCE_NOT_FOUND', 'リソースが見つかりません', 404, { resourceType, resourceId: String(resourceId) }),
  validation: (issues: Array<{ field: string; message: string }>) =>
    new AppError('VALIDATION_FAILED', '入力値が不正です', 400, { issues }),
  internal: () => new AppError('INTERNAL_ERROR', 'サーバー内部エラーが発生しました', 500),

  // バーガー
  burgerNotFound: (id: string | number) =>
    new AppError('BURGER_NOT_FOUND', '指定のバーガーが見つかりません', 404, { burgerId: String(id) }),
  burgerUnavailable: (id: string | number) =>
    new AppError('BURGER_UNAVAILABLE', 'このバーガーは現在販売されていません', 400, { burgerId: String(id) }),

  // カート
  cartEmpty: () => new AppError('CART_EMPTY', 'カートが空です', 400),
  cartItemNotFound: (itemId: string | number) =>
    new AppError('CART_ITEM_NOT_FOUND', 'カートアイテムが見つかりません', 404, { itemId: String(itemId) }),
  cartItemOptionsImmutable: () =>
    new AppError('CART_ITEM_OPTIONS_IMMUTABLE', 'オプションは変更できません。削除して追加しなおしてください', 400),

  // 注文
  orderNotFound: (id: string | number) =>
    new AppError('ORDER_NOT_FOUND', '注文が見つかりません', 404, { orderId: String(id) }),
  orderCancelNotAllowed: (currentStatus: string) =>
    new AppError('ORDER_CANCEL_NOT_ALLOWED', '現在のステータスではキャンセルできません', 409, { currentStatus }),
  orderInvalidStatusTransition: (current: string, requested: string, allowed: string[]) =>
    new AppError('ORDER_INVALID_STATUS_TRANSITION', 'この状態からは指定のステータスに遷移できません', 409,
      { current, requested, allowed }),
  idempotencyInProgress: (key: string) =>
    new AppError('ORDER_IDEMPOTENCY_IN_PROGRESS', '同じキーで処理が実行中です。少し待って再試行してください', 409,
      { idempotencyKey: key }),
  idempotencyConflict: (key: string) =>
    new AppError('ORDER_IDEMPOTENCY_CONFLICT', '同じキーで異なる内容のリクエストが既に送信されています', 422,
      { idempotencyKey: key }),
} as const;
