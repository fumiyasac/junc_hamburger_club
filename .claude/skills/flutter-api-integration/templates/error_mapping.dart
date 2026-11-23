// lib/core/services/error_mapping.dart
//
// Dio の例外・レスポンス → ApiException のマッピング。
// 新しい error.code を追加したら docs/error_codes.md と api_exception.dart と
// この switch の 3 箇所を同時に更新する。

import 'package:dio/dio.dart';
import 'api_exception.dart';

ApiException mapDioException(DioException e) {
  final response = e.response;

  // ネットワーク断・タイムアウト等でレスポンス無し
  if (response == null) {
    return const UnknownApiException('INTERNAL_ERROR', '通信エラーが発生しました', null);
  }

  final body = response.data;
  if (body is! Map<String, dynamic>) {
    return UnknownApiException(
      'INTERNAL_ERROR',
      'HTTP ${response.statusCode}',
      null,
    );
  }

  final err = body['error'];
  if (err is! Map<String, dynamic>) {
    return UnknownApiException(
      'INTERNAL_ERROR',
      body['message']?.toString() ?? 'unknown',
      null,
    );
  }

  final code = err['code'] as String? ?? 'INTERNAL_ERROR';
  final message = err['message'] as String? ?? '';
  final details = err['details'] as Map<String, dynamic>?;

  return switch (code) {
    // 認証
    'TOKEN_MISSING' => TokenMissingException(message),
    'TOKEN_EXPIRED' => TokenExpiredException(message),
    'TOKEN_INVALID' => TokenInvalidException(message),
    'TOKEN_REUSE_DETECTED' => TokenReuseDetectedException(message),
    'USER_DEACTIVATED' => UserDeactivatedException(message),
    'RATE_LIMIT_EXCEEDED' => RateLimitExceededException(
        (details?['retryAfterSeconds'] as int?) ?? 60,
        message,
      ),
    // 共通
    'VALIDATION_FAILED' => ValidationFailedException(
        ((details?['issues'] as List?) ?? const [])
            .cast<Map<String, dynamic>>(),
        message,
      ),
    'RESOURCE_NOT_FOUND' => ResourceNotFoundException(
        details?['resourceType'] as String? ?? '',
        details?['resourceId'] as String? ?? '',
        message,
      ),
    // ドメイン (必要なものだけ)
    'CART_EMPTY' => CartEmptyException(message),
    'PICKUP_SLOT_FULL' => PickupSlotFullException(
        details?['slotAt'] as String? ?? '',
        message,
      ),
    'OPTION_OUT_OF_STOCK_AT_ORDER' => OptionOutOfStockAtOrderException(
        details?['itemId'] as String? ?? '',
        details?['optionId'] as String? ?? '',
        details?['optionName'] as String? ?? '',
        message,
      ),
    'ORDER_INVALID_STATUS_TRANSITION' => OrderInvalidStatusTransitionException(
        details?['current'] as String? ?? '',
        details?['requested'] as String? ?? '',
        ((details?['allowed'] as List?) ?? const []).cast<String>(),
        message,
      ),
    // 未知: UnknownApiException で握る (フォールバック)
    _ => UnknownApiException(code, message, details),
  };
}
