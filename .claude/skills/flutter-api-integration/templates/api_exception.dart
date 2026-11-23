// lib/core/services/api_exception.dart
//
// User API の統一エラー形式 ({code, message, details}) を sealed class 階層に
// マッピングする型定義。switch で網羅チェックが効く。
// docs/error_codes.md と対応。

sealed class ApiException implements Exception {
  final String code;
  final String message;
  final Map<String, dynamic>? details;
  const ApiException(this.code, this.message, this.details);

  @override
  String toString() => '$code: $message';
}

// ── 認証 (docs/flutter_auth_guide.md のインターセプターが分岐に使う) ─────
class TokenMissingException extends ApiException {
  const TokenMissingException([String message = 'ログインが必要です'])
      : super('TOKEN_MISSING', message, null);
}
class TokenExpiredException extends ApiException {
  const TokenExpiredException([String message = 'トークンの有効期限が切れています'])
      : super('TOKEN_EXPIRED', message, null);
}
class TokenInvalidException extends ApiException {
  const TokenInvalidException([String message = '認証トークンが不正です'])
      : super('TOKEN_INVALID', message, null);
}
class TokenReuseDetectedException extends ApiException {
  const TokenReuseDetectedException([
    String message = 'トークンの再利用を検知したため全セッションを失効しました',
  ]) : super('TOKEN_REUSE_DETECTED', message, null);
}
class UserDeactivatedException extends ApiException {
  const UserDeactivatedException([String message = 'アカウントが無効化されています'])
      : super('USER_DEACTIVATED', message, null);
}
class RateLimitExceededException extends ApiException {
  final int retryAfterSeconds;
  RateLimitExceededException(this.retryAfterSeconds, [String message = 'リクエストが多すぎます'])
      : super('RATE_LIMIT_EXCEEDED', message, {'retryAfterSeconds': retryAfterSeconds});
}

// ── 共通 ───────────────────────────────────────────────────────────
class ValidationFailedException extends ApiException {
  final List<Map<String, dynamic>> issues;
  ValidationFailedException(this.issues, [String message = '入力値が不正です'])
      : super('VALIDATION_FAILED', message, {'issues': issues});
}
class ResourceNotFoundException extends ApiException {
  final String resourceType;
  final String resourceId;
  ResourceNotFoundException(this.resourceType, this.resourceId, [String message = 'リソースが見つかりません'])
      : super('RESOURCE_NOT_FOUND', message,
          {'resourceType': resourceType, 'resourceId': resourceId});
}

// ── ドメイン (必要なものだけ列挙) ─────────────────────────────────
class CartEmptyException extends ApiException {
  const CartEmptyException([String message = 'カートが空です'])
      : super('CART_EMPTY', message, null);
}
class PickupSlotFullException extends ApiException {
  final String slotAt;
  PickupSlotFullException(this.slotAt, [String message = 'この時間帯は予約がいっぱいです'])
      : super('PICKUP_SLOT_FULL', message, {'slotAt': slotAt});
}
class OptionOutOfStockAtOrderException extends ApiException {
  final String itemId;
  final String optionId;
  final String optionName;
  OptionOutOfStockAtOrderException(this.itemId, this.optionId, this.optionName,
      [String message = 'カート内オプションが売り切れになりました'])
      : super('OPTION_OUT_OF_STOCK_AT_ORDER', message,
          {'itemId': itemId, 'optionId': optionId, 'optionName': optionName});
}
class OrderInvalidStatusTransitionException extends ApiException {
  final String current;
  final String requested;
  final List<String> allowed;
  OrderInvalidStatusTransitionException(this.current, this.requested, this.allowed,
      [String message = 'この状態からは指定のステータスに遷移できません'])
      : super('ORDER_INVALID_STATUS_TRANSITION', message,
          {'current': current, 'requested': requested, 'allowed': allowed});
}

// ── フォールバック ─────────────────────────────────────────────
// 新しいコードが追加された際、mapper が未対応でもここで握れる
class UnknownApiException extends ApiException {
  const UnknownApiException(super.code, super.message, super.details);
}
