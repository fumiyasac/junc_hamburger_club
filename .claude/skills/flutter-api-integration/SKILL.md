---
name: flutter-api-integration
description: Flutter アプリで Mock Repository を User API の実装 (Dio) に差し替えて、accessToken 付与・401 時の自動 refresh (多重防止 mutex) ・ error.code の sealed 例外マッピング・POST /orders の Idempotency-Key 発行・USE_MOCK dart-define による切替を揃える。「Flutter で実 API に繋ぐ」「401 時の自動リフレッシュ」「Dio Interceptor」「モバイルの認証」「ApiException 設計」などの依頼で使用する。
---

# Flutter 実 API 配線の手順

User API (PR #65 統一エラー + #66 リフレッシュトークン) に対して、Flutter の抽象 Repository の **Api 実装** 側を書く。方針は [`docs/flutter_auth_guide.md`](../../../docs/flutter_auth_guide.md) を**正本**とし、本 Skill はそこに書いていない「実装手順」「エラー型マップ」「Mock との切替」を定義する。

前提:
- [`docs/error_codes.md`](../../../docs/error_codes.md) — エラーコード表
- [`docs/flutter_auth_guide.md`](../../../docs/flutter_auth_guide.md) — Interceptor mutex、保存場所
- `flutter-feature` Skill — 新規画面を 3 層 Repository で作る手順
- [`junc_hamburger_club_mobile/CLAUDE.md`](../../../junc_hamburger_club_mobile/CLAUDE.md) — freezed / build_runner 禁止

## まずやる: 切替変数 `USE_MOCK`

```bash
# Mock (バックエンド不要、CI 想定)
flutter run -d "iPhone 17 Pro Max" --dart-define=USE_MOCK=true

# 実 API (local-dev-env Skill の scripts/dev-up.sh でバックエンド起動済み)
flutter run -d "iPhone 17 Pro Max" --dart-define=USE_MOCK=false --dart-define=API_HOST=localhost
flutter run -d emulator-5556      --dart-define=USE_MOCK=false --dart-define=API_HOST=10.0.2.2
```

Provider 側で切替:

```dart
final burgerRepositoryProvider = Provider<BurgerRepository>((ref) {
  const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: false);
  if (useMock) return MockBurgerRepository();
  return ApiBurgerRepository(ref.read(apiClientProvider));
});
```

デフォルト `false` (実 API)。Maestro E2E や PR の初動は `USE_MOCK=true` を明示する。

## 作業順序

### 1. `ApiException` を sealed class で定義

[`templates/api_exception.dart`](templates/api_exception.dart) を参考に `lib/core/services/api_exception.dart` を作成。

- `sealed class ApiException extends Exception` + サブクラス:
  - `TokenMissingException`, `TokenExpiredException`, `TokenInvalidException`, `TokenReuseDetectedException`, `UserDeactivatedException`, `RateLimitExceededException(retryAfterSeconds)`
  - `ValidationFailedException(issues)`, `ResourceNotFoundException(resourceType, resourceId)`
  - ドメイン特有: `PickupSlotFullException`, `OptionOutOfStockAtOrderException(itemId, optionId, optionName)` 等 (必要な分だけ)
  - 汎用フォールバック: `UnknownApiException(code, message, details)`
- `switch (e) { case TokenExpiredException(): ... }` で網羅チェック可能

### 2. `error_mapping.dart` で DioException → ApiException

[`templates/error_mapping.dart`](templates/error_mapping.dart) を参考に:

```dart
ApiException mapDioException(DioException e) {
  final response = e.response;
  if (response == null) {
    return const UnknownApiException('INTERNAL_ERROR', '通信エラーが発生しました', null);
  }
  final body = response.data;
  if (body is! Map<String, dynamic>) {
    return UnknownApiException('INTERNAL_ERROR', 'HTTP ${response.statusCode}', null);
  }
  final err = body['error'] as Map<String, dynamic>?;
  if (err == null) return const UnknownApiException('INTERNAL_ERROR', 'unknown', null);
  final code = err['code'] as String;
  final message = err['message'] as String? ?? '';
  final details = err['details'] as Map<String, dynamic>?;
  return switch (code) {
    'TOKEN_MISSING' => TokenMissingException(message),
    'TOKEN_EXPIRED' => TokenExpiredException(message),
    // ... (全マップ)
    _ => UnknownApiException(code, message, details),
  };
}
```

**`error.code` は [`docs/error_codes.md`](../../../docs/error_codes.md) を正本**とし、ここに追加するコードは必ず mapper にも追加する。未知の code は `UnknownApiException` で握るので安全側に倒せる。

### 3. `ApiClient` と Auth Interceptor

[`templates/auth_interceptor.dart`](templates/auth_interceptor.dart) を参考に `lib/core/services/auth_interceptor.dart` を作成。既存の `lib/core/services/api_client.dart` の `_dio.interceptors.add(...)` に追加する。

**挙動** (`docs/flutter_auth_guide.md` の設計をコード化):

- リクエスト前: メモリ保持の accessToken を `Authorization: Bearer ...` に付与
- 401 かつ `error.code == 'TOKEN_EXPIRED'` のみ `/auth/refresh` を呼ぶ:
  - **`Completer<AuthData>? _pendingRefresh` の mutex** で、並列 401 を 1 回の refresh に合流
  - refresh 成功 → 新 accessToken を保存 → 元リクエストを `_dio.fetch(req)` で再送
  - refresh 失敗 → accessToken / refreshToken を削除 → `onSignOut` コールバックでログイン画面へ遷移
- `TOKEN_INVALID` / `TOKEN_REUSE_DETECTED` / `USER_DEACTIVATED` → 即ログイン画面 (refresh 試行しない)
- `RATE_LIMIT_EXCEEDED` → そのまま例外として投げる (UI で `retryAfterSeconds` 使う)

**mutex のミニマム実装**:

```dart
Future<AuthData>? _pendingRefresh;

Future<AuthData> _refreshOnce() async {
  _pendingRefresh ??= _doRefresh();
  try {
    return await _pendingRefresh!;
  } finally {
    _pendingRefresh = null;
  }
}
```

### 4. トークン保存 (`AuthStore`)

```dart
class AuthStore {
  final FlutterSecureStorage _secure;
  String? _accessTokenMemory;     // メモリ (15 分の TTL)
  VoidCallback? onSignOut;

  Future<void> writeTokens(String access, String refresh) async {
    _accessTokenMemory = access;
    await _secure.write(key: 'refresh_token', value: refresh);
  }
  String? readAccessToken() => _accessTokenMemory;
  Future<String?> readRefreshToken() => _secure.read(key: 'refresh_token');
  Future<void> clear() async {
    _accessTokenMemory = null;
    await _secure.delete(key: 'refresh_token');
  }
}
```

- accessToken はメモリのみ (15 分で expire、再起動時は refreshToken から silent login)
- refreshToken は `flutter_secure_storage` (OS キーチェーン)
- `SharedPreferences` は NG (暗号化なし)

### 5. Repository の Api 実装

`flutter-feature` Skill の 3 層構造 (abstract + Api + Mock) のうち、Api 実装を書く。

```dart
class ApiBurgerRepository implements BurgerRepository {
  final ApiClient _client;
  ApiBurgerRepository(this._client);

  @override
  Future<List<Burger>> getBurgers({String? category}) async {
    try {
      final res = await _client.get<Map<String, dynamic>>(
        '/burgers',
        queryParameters: category == null ? null : {'category': category},
      );
      final data = res.data!['data'] as Map<String, dynamic>;
      final items = data['burgers'] as List;
      return items.map((j) => Burger.fromJson(j as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
```

### 6. `POST /orders` の Idempotency-Key

user-api の仕様 (#65):
- 同じキー + 同じ body → 保存レスポンス再生 (サーバーが冪等化)
- 同じキー + 違う body → 422 `ORDER_IDEMPOTENCY_CONFLICT`
- 処理中に同キー再送 → 409 `ORDER_IDEMPOTENCY_IN_PROGRESS`
- 失敗 (CART_EMPTY など) → PENDING 行削除 → 同キーで再試行可能

**Flutter 側の規約**:

- **注文確定ボタンを押した瞬間に UUID v4 を 1 つ生成し、その送信試行が終わるまで同じキーを使う**
- `uuid` パッケージ (pubspec に追加) の `Uuid().v4()` で生成
- ネットワーク失敗 → 同じキーで再送 (サーバーが 1 回しか処理しない)
- 成功レスポンスを受け取ったら「次の注文の準備」= 新しいキーを採番
- `ORDER_IDEMPOTENCY_CONFLICT` が返った場合は実装バグ (body を変えずにキーを使い回したか未更新で再送した) → アサーション

```dart
Future<Order> createOrder({required String? pickupAt, String? notes}) async {
  final key = const Uuid().v4();   // ボタン押下時に 1 回だけ生成
  return _createOrderWithKey(key, pickupAt: pickupAt, notes: notes);
}

Future<Order> _createOrderWithKey(String key, {String? pickupAt, String? notes}) async {
  try {
    final res = await _client.post<Map<String, dynamic>>(
      '/orders',
      data: {'pickupAt': pickupAt, 'notes': notes},
      options: Options(headers: {'Idempotency-Key': key}),
    );
    return Order.fromJson(res.data!['data'] as Map<String, dynamic>);
  } on DioException catch (e) {
    throw mapDioException(e);
  }
}
```

### 7. エラー → UI 分岐

`AsyncNotifier` の `error` に `ApiException` を入れる (`mapDioException` で変換済み)。画面側:

```dart
state.when(
  data: (order) => OrderSuccessView(order),
  loading: () => const Loading(),
  error: (e, _) => switch (e) {
    PickupSlotFullException() => const SlotFullBanner(),
    OptionOutOfStockAtOrderException() => OptionSoldOutBanner(e),
    ValidationFailedException() => ValidationErrors(e.issues),
    RateLimitExceededException() => RetryAfterBanner(e.retryAfterSeconds),
    _ => ErrorBanner(message: e.toString()),
  },
);
```

- `TokenExpiredException` は Interceptor が回収するので UI には到達しない (まれに refresh 失敗時のみ fallback が呼ばれる)
- `TokenInvalidException` / `TokenReuseDetectedException` / `UserDeactivatedException` → Interceptor 内で `onSignOut` を呼ぶ構成なので UI 到達も稀

## 最終チェックリスト

- [ ] `api_exception.dart` に sealed class + エラーコード全サブクラス定義
- [ ] `error_mapping.dart` の switch が `docs/error_codes.md` のコードを網羅
- [ ] `auth_interceptor.dart` に accessToken 付与 + 401 時 refresh + Completer mutex を実装
- [ ] `AuthStore` が flutter_secure_storage を使い、accessToken はメモリのみ
- [ ] Repository の Api 実装は `on DioException catch (e) { throw mapDioException(e); }` で統一
- [ ] `POST /orders` は `Idempotency-Key` ヘッダを UUID v4 で 1 回だけ生成
- [ ] Provider が `USE_MOCK` dart-define で Mock / Api を切替
- [ ] `--dart-define=API_HOST=localhost` (iOS) / `10.0.2.2` (Android) で動作確認
- [ ] 401 から refresh → 元リクエスト再送の往復を手動で確認 (accessToken を 0 秒に短縮して試験)
- [ ] 多重リフレッシュしないことを確認 (同時に 5 本リクエストを発火 → refresh は 1 回だけ)

## 禁止事項

- **`SharedPreferences` に refreshToken を保存しない** (暗号化なし)
- **accessToken を永続化しない** (15 分で expire、メモリ保持のみ)
- **`error.code` を文字列マッチせずに int コードで判定しない** (必ず定数文字列 / sealed class)
- **`freezed` / `@riverpod` / `build_runner` を導入しない** (`flutter-feature` Skill と CLAUDE.md 参照)
- **Idempotency-Key を毎リトライで採番しない** (ボタン押下 1 回につき 1 つ)
- **Mock 実装をいきなり消さない** (3 層を維持。Maestro E2E が USE_MOCK=true 前提)
