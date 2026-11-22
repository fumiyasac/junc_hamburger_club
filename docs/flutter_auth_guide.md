# Flutter 認証実装ガイド

> Flutter アプリ (`junc_hamburger_club_mobile/`) で User API の認証を実装する際のメモ。
> API 仕様は [`user-api/swagger/openapi.yaml`](../junc_hamburger_club_backend/user-api/swagger/openapi.yaml)、
> エラーコードは [`error_codes.md`](error_codes.md) 参照。

## 保存場所

| 項目 | 推奨 | 理由 |
|---|---|---|
| `accessToken` | **メモリ (Riverpod `AsyncNotifier`)** | TTL 15 分、プロセス終了で破棄される前提 |
| `refreshToken` | **`flutter_secure_storage`** | 30 日有効、OS キーチェーン保護が必須 |
| `user` 情報 | メモリ + `shared_preferences` 冪等キャッシュ | UI の初期描画高速化 |

## ログイン〜以降のフロー

1. `POST /auth/login` → `{accessToken, refreshToken, accessTokenExpiresIn, refreshTokenExpiresIn, user}`
2. `accessToken` はメモリに、`refreshToken` は secure storage に保存
3. 全 API 呼び出しに `Authorization: Bearer <accessToken>` を付与
4. `TOKEN_EXPIRED` 401 を受けたら **自動リフレッシュ** (下記)
5. ログアウト時に `POST /auth/logout { refreshToken }` を叩き、両方削除

## 自動リフレッシュ (Dio Interceptor)

### 単一 mutex で多重リフレッシュを防ぐ

複数の API が同時に 401 を返した場合、全てが一斉に `/auth/refresh` を叩くと **ローテーションの結果が不整合** になる (サーバ側で `TOKEN_REUSE_DETECTED` が発火し全セッション失効)。Completer / Future を共有する実装にする:

```dart
class AuthInterceptor extends Interceptor {
  final Dio _dio;
  final AuthStore _store;
  Future<AuthData>? _pendingRefresh;   // mutex 代わり

  AuthInterceptor(this._dio, this._store);

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final res = err.response;
    if (res?.statusCode != 401) return handler.next(err);
    final code = (res?.data as Map?)?['error']?['code'] as String?;

    if (code != 'TOKEN_EXPIRED') {
      // TOKEN_INVALID / TOKEN_REUSE_DETECTED / USER_DEACTIVATED → ログイン画面へ
      await _store.clear();
      _store.onSignOut?.call();
      return handler.next(err);
    }

    try {
      // 複数リクエストが同時に 401 → 同じ Future を await する
      _pendingRefresh ??= _refreshOnce();
      final newTokens = await _pendingRefresh!;
      // 元のリクエストを新しいトークンで再送
      final req = err.requestOptions;
      req.headers['Authorization'] = 'Bearer ${newTokens.accessToken}';
      final response = await _dio.fetch(req);
      return handler.resolve(response);
    } catch (_) {
      await _store.clear();
      _store.onSignOut?.call();
      return handler.next(err);
    } finally {
      _pendingRefresh = null;
    }
  }

  Future<AuthData> _refreshOnce() async {
    final refresh = await _store.readRefreshToken();
    if (refresh == null) throw StateError('no refresh token');
    final r = await _dio.post('/auth/refresh', data: {'refreshToken': refresh});
    final data = AuthData.fromJson(r.data['data'] as Map<String, dynamic>);
    await _store.writeAccessToken(data.accessToken);
    await _store.writeRefreshToken(data.refreshToken);
    return data;
  }
}
```

### 推奨パッケージ

- `dio` — HTTP クライアント
- `flutter_secure_storage` — refreshToken 永続化
- `flutter_riverpod` 3.x — 状態管理
- トークン保存は **secure storage のみ**。SharedPreferences は NG (暗号化なし)

## エラーコード → UI 分岐

| code | UI 挙動 |
|---|---|
| `TOKEN_EXPIRED` | 透過的にリフレッシュして再送 |
| `TOKEN_INVALID` / `TOKEN_REUSE_DETECTED` | トークン破棄 → ログイン画面 (強制サインアウト) |
| `USER_DEACTIVATED` | 「アカウントが無効化されています」ダイアログ → ログイン画面 |
| `RATE_LIMIT_EXCEEDED` | `details.retryAfterSeconds` 後にリトライ、ボタン押下は無効化 |
| `USER_LOGIN_FAILED` | ログインフォームの下にメッセージ表示 |

## 競合シナリオの扱い

### シナリオ 1: 端末 A で refresh、直後に端末 B で refresh
- 別 `family_id` のため干渉しない。両端末それぞれで独立にローテーション

### シナリオ 2: オフライン → 復帰時に 401 複数発火
- 上記 interceptor の mutex により 1 回だけ refresh される

### シナリオ 3: refresh のレスポンスを受け取る前にネットワーク切断、再送
- 90 秒以内なら `prev_token_hash` 一致で grace により正常にローテーション
- 90 秒超は `TOKEN_REUSE_DETECTED` → **全端末ログアウト** (再ログインが必要)

## テスト観点

- [ ] ログイン → 15 分以内に API 呼び出し → 200
- [ ] 15 分超のアクセストークンで API → 401 TOKEN_EXPIRED → 透過 refresh → 元リクエストが 200
- [ ] 旧 refreshToken で `/auth/refresh` 2 回目 → 90 秒以内なら OK、超えたら `TOKEN_REUSE_DETECTED` で全セッション失効
- [ ] `TOKEN_INVALID` / `USER_DEACTIVATED` でログイン画面強制遷移
- [ ] 並列 10 本の API が 401 → refresh は 1 回だけ発火
- [ ] アプリ再起動 → secure storage から refreshToken 復元 → silent 再ログイン
