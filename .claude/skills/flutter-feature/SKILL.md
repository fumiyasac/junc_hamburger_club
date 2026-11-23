---
name: flutter-feature
description: Flutter アプリ (junc_hamburger_club_mobile) に新規画面・新機能を追加するとき、MVVM + Repository (抽象 + Api + Mock の 3 層) + Riverpod 3.x の既存パターンに沿わせ、禁止されている freezed / @riverpod / build_runner / StateNotifier / valueOrNull を踏まないようにする。「Flutter に画面を追加」「新しい ViewModel」「Riverpod で状態管理」「新しい機能を Flutter で」などの依頼で使用する。実 API への配線作業は `flutter-api-integration` Skill を参照。
---

# Flutter 機能追加の手順

このプロジェクトは **コード生成を一切使わない Riverpod 3.x** の方針。詳細は [`junc_hamburger_club_mobile/CLAUDE.md`](../../../junc_hamburger_club_mobile/CLAUDE.md) と [`architecture_guideline.md`](../../../architecture_guideline.md) §2, §3, §10 に全て書かれているので、本 Skill では**地雷回避と作業順序**に集中する。

## 絶対に使わないもの

| 禁止 | 代わりに使うもの |
|---|---|
| `freezed` パッケージ | 手書きの `copyWith` を持つ通常クラス |
| `@riverpod` / `build_runner` | `NotifierProvider` / `AsyncNotifierProvider` を**手動で**定義 |
| `StateNotifier` | `Notifier<State>` / `AsyncNotifier<State>` |
| `state.valueOrNull` | `state.value` (`valueOrNull` は Riverpod 3.x で削除) |
| `build()` 内の `AsyncValue.guard(() => build())` | `build()` は直接 await。`guard()` は `refresh()` 等の別メソッドでのみ使う |

違反は PR で即差し戻し。

## 現状の前提: Repository は 3 層構成

PR #65 / #66 で user-api が実運用相当まで整備され、**Flutter 側は「Mock 固定」ではなく「抽象 Repository + Api 実装 + Mock 実装」併設**を前提にする。新機能も**両方を用意**する。

```
lib/data/repositories/
├── burger_repository.dart           — abstract class BurgerRepository
├── burger_api_repository.dart       — class ApiBurgerRepository implements BurgerRepository
└── burger_mock_repository.dart      — class MockBurgerRepository implements BurgerRepository
```

Provider で `--dart-define=USE_MOCK=true/false` により切り替える。配線の詳細は **`flutter-api-integration` Skill** を参照。

- デザインは Material 3 + Nunito。色は `core/theme/app_theme.dart` の `AppColors` を使い **hex ハードコード禁止**
- ルーティングは [`core/router/app_router.dart`](../../../junc_hamburger_club_mobile/lib/core/router/app_router.dart) の GoRouter + ShellRoute。ボトムナビは ShellRoute が担当。各画面に `BottomNavigationBar` を書かない

## ディレクトリ対応 (MVVM)

```
lib/
├── presentation/   # View (Widget) — screens/ widgets/
├── viewmodels/     # ViewModel — *_viewmodel.dart
├── data/
│   ├── models/         # データクラス + copyWith
│   ├── repositories/   # abstract + ApiImpl + MockImpl の 3 ファイル
│   └── sources/        # mock_data.dart、api_client.dart
├── providers/      # Riverpod Provider 定義 (providers.dart に集約)
└── core/           # constants / router / services / theme
```

## 作業順序

### 1. Model

[`templates/model.dart`](templates/model.dart) を参考に `lib/data/models/<entity>.dart` を作成。

- クラスに `final` フィールド
- `const` コンストラクタ (immutable)
- `copyWith`, `fromJson` (camelCase キー), `toJson`, `==` / `hashCode` を手書き
- nullable は `String?` / `int?` で明示

### 2. Repository (3 層)

[`templates/repository.dart`](templates/repository.dart) を参考に以下 3 ファイルを作成:

- `lib/data/repositories/<entity>_repository.dart` — `abstract class <Entity>Repository`
- `lib/data/repositories/<entity>_api_repository.dart` — `class Api<Entity>Repository implements <Entity>Repository` (Dio で user-api 叩く)
- `lib/data/repositories/<entity>_mock_repository.dart` — `class Mock<Entity>Repository implements <Entity>Repository` (mock_data.dart 使用、`await Future.delayed(const Duration(milliseconds: 400))` で擬似遅延)

**API 実装は `flutter-api-integration` Skill のパターンに揃える** (`ApiClient` 経由、`ApiException` 変換、accessToken 付与、401 の自動 refresh)。

### 3. Provider 登録

[`lib/providers/providers.dart`](../../../junc_hamburger_club_mobile/lib/providers/providers.dart) の "Repositories" セクションに追加:

```dart
final myEntityRepositoryProvider = Provider<MyEntityRepository>((ref) {
  const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: false);
  if (useMock) return MockMyEntityRepository();
  return ApiMyEntityRepository(ref.read(apiClientProvider));
});
```

### 4. ViewModel

[`templates/viewmodel.dart`](templates/viewmodel.dart) に 2 パターン (同期 Notifier / 非同期 AsyncNotifier) の雛形あり。

**どちらを使うかの判断**:

| 用途 | Provider |
|---|---|
| カート・フォーム・認証など同期的な UI 状態 | `NotifierProvider<VM, State>` + `Notifier<State>` |
| API/モックからの非同期データ取得 | `AsyncNotifierProvider<VM, State>` + `AsyncNotifier<State>` |
| 単一インスタンス (Repository など) | `Provider<T>` |

**AsyncNotifier の作法**:

- `Future<State> build() async { ... }` の中で直接 `await` する。`AsyncValue.guard` を**ここで**呼ばない (再帰になる)
- リフレッシュは別メソッドで:
  ```dart
  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => build());
  }
  ```
- 画面側から読むときは `state.when(data:, loading:, error:)`

**Notifier (同期) の作法**:

- `State build() => const State();` で初期値を返す
- 操作は `state = state.copyWith(...)` で immutable に更新
- エラーは State にフィールドとして持つ (`ApiException? error`)

### 5. Screen

[`templates/screen.dart`](templates/screen.dart) を参考に `lib/presentation/screens/<feature>/<name>_screen.dart` を作成。

- 子 Widget からも provider を読むなら `ConsumerWidget`、状態を持つなら `ConsumerStatefulWidget`
- AsyncValue は `state.when(data: ..., loading: () => const ShimmerLoading(), error: (e, _) => _ErrorView(e))` で捌く
- `ApiException` のサブクラスで分岐: `TokenExpiredException` は interceptor が自動 refresh するので UI 到達は稀、`UserDeactivatedException` はログイン画面へ、など (`flutter-api-integration` Skill 参照)
- 色は `AppColors.*`。ハードコード禁止
- 同期的な ViewModel の操作は `ref.read(myVmProvider.notifier).doSomething()`

### 6. Router 登録

[`lib/core/router/app_router.dart`](../../../junc_hamburger_club_mobile/lib/core/router/app_router.dart) に `GoRoute` を追加。

- ボトムナビに表示するタブなら ShellRoute 配下に
- 詳細画面などモーダル的に `push` するなら ShellRoute の外に

### 7. 検証

```bash
cd junc_hamburger_club_mobile
flutter analyze      # エラー・警告ゼロを保つ
flutter test         # 既存の placeholder_test は落とさない

# Mock で動かす (バックエンド不要)
flutter run -d "iPhone 17 Pro Max" --dart-define=USE_MOCK=true

# 実 API に繋ぐ (バックエンド起動必須。local-dev-env Skill で scripts/dev-up.sh)
flutter run -d "iPhone 17 Pro Max" --dart-define=USE_MOCK=false --dart-define=API_HOST=localhost
flutter run -d emulator-5556      --dart-define=USE_MOCK=false --dart-define=API_HOST=10.0.2.2
```

## 最終チェックリスト

- [ ] `freezed` / `@riverpod` / `StateNotifier` を使っていない
- [ ] `state.valueOrNull` を使っていない (`state.value` を使う)
- [ ] `AsyncNotifier.build()` の中で `AsyncValue.guard` を呼んでいない
- [ ] Model に `copyWith` / `fromJson` / `toJson` / `==` / `hashCode` が揃っている
- [ ] Repository が **abstract + Api 実装 + Mock 実装の 3 ファイル**
- [ ] Provider が USE_MOCK で Api/Mock を切り替えている
- [ ] ViewModel の State クラスが immutable + `copyWith`
- [ ] Screen の色が `AppColors.*` 経由 (hex ハードコードなし)
- [ ] Router 登録済み
- [ ] Mock 実装の疑似遅延がある (UI のローディング確認用)
- [ ] `flutter analyze` ゼロエラー
- [ ] Mock モード (USE_MOCK=true) と Api モード (バックエンド起動後) の両方で動作確認

## E2E テスト追加

新しい TextField や操作を Maestro で検証する場合は、必要最小限の `Semantics(identifier: '...')` を付ける方針。詳しくは `maestro-e2e-flow` Skill を参照。Maestro は Mock モードを前提 (バックエンド非依存)。

## 実 API 配線について

Repository の Api 実装側の詳細 (`ApiClient` の使い方、`ApiException` マッピング、Idempotency-Key、accessToken リフレッシュ) は **`flutter-api-integration` Skill** を参照。本 Skill では「3 層構成を作る」までが範囲。
