// lib/core/services/auth_interceptor.dart
//
// docs/flutter_auth_guide.md の Interceptor 設計をコード化。
//   - リクエスト前: Bearer accessToken 付与
//   - TOKEN_EXPIRED 401 → /auth/refresh を 1 回だけ (mutex で多重防止) → 元 req 再送
//   - TOKEN_INVALID / TOKEN_REUSE_DETECTED / USER_DEACTIVATED → ログイン画面強制
//
// 使い方 (api_client.dart 内):
//   _dio.interceptors.add(AuthInterceptor(_dio, authStore));

import 'package:dio/dio.dart';
import 'auth_store.dart';           // 既存の AuthStore
import 'api_exception.dart';
import 'error_mapping.dart';

class AuthInterceptor extends Interceptor {
  final Dio _dio;
  final AuthStore _store;
  Future<_RefreshResult>? _pendingRefresh;   // Completer 相当の mutex

  AuthInterceptor(this._dio, this._store);

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // /auth/refresh 自身にはアクセストークンを付与しない
    if (options.path.endsWith('/auth/refresh')) {
      return handler.next(options);
    }
    final token = _store.readAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final res = err.response;
    if (res?.statusCode != 401) return handler.next(err);
    final code = ((res?.data as Map?)?['error'] as Map?)?['code'] as String?;

    // Refresh 可能なのは TOKEN_EXPIRED のみ。それ以外は即サインアウト
    if (code != 'TOKEN_EXPIRED') {
      if (code == 'TOKEN_INVALID' ||
          code == 'TOKEN_REUSE_DETECTED' ||
          code == 'USER_DEACTIVATED') {
        await _store.clear();
        _store.onSignOut?.call();
      }
      return handler.next(err);
    }

    try {
      final result = await _refreshOnce();
      // 再送: 新アクセストークンで元リクエストを再発行
      final req = err.requestOptions;
      req.headers['Authorization'] = 'Bearer ${result.accessToken}';
      final retried = await _dio.fetch(req);
      return handler.resolve(retried);
    } on ApiException catch (e) {
      // refresh 自体が失敗 → サインアウト
      await _store.clear();
      _store.onSignOut?.call();
      return handler.reject(DioException(requestOptions: err.requestOptions, error: e));
    }
  }

  // Completer mutex: 並列 401 が来ても refresh は 1 回だけ
  Future<_RefreshResult> _refreshOnce() async {
    _pendingRefresh ??= _doRefresh();
    try {
      return await _pendingRefresh!;
    } finally {
      _pendingRefresh = null;
    }
  }

  Future<_RefreshResult> _doRefresh() async {
    final refresh = await _store.readRefreshToken();
    if (refresh == null) {
      throw const TokenInvalidException('リフレッシュトークンがありません');
    }
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refresh},
      );
      final data = res.data!['data'] as Map<String, dynamic>;
      final access = data['accessToken'] as String;
      final newRefresh = data['refreshToken'] as String;
      await _store.writeTokens(access, newRefresh);
      return _RefreshResult(access);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}

class _RefreshResult {
  final String accessToken;
  _RefreshResult(this.accessToken);
}
