---
name: flutter-feature
description: Flutter アプリ (junc_hamburger_club_mobile) に新規画面・新機能を追加するとき、MVVM + Repository + Riverpod 3.x の既存パターンに沿わせ、禁止されている freezed / @riverpod / build_runner / StateNotifier / valueOrNull を踏まないようにする。「Flutter に画面を追加」「新しい ViewModel」「Riverpod で状態管理」「新しい機能を Flutter で」などの依頼で使用する。
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

## 現状の重要な前提

- **Repository は全てモック実装**。`data/sources/mock_data.dart` を返している (`CLAUDE.md` 既知の不一致参照)。実 API 接続はまだ未配線。新機能も**モック → 将来の実 API**の順で作る
- デザインは Material 3 + Nunito。色は `core/theme/app_theme.dart` の `AppColors` を使い **hex ハードコード禁止**
- ルーティングは [`core/router/app_router.dart`](../../../junc_hamburger_club_mobile/lib/core/router/app_router.dart) の GoRouter + ShellRoute。ボトムナビは ShellRoute が担当。各画面に `BottomNavigationBar` を書かない

## ディレクトリ対応 (MVVM)

```
lib/
├── presentation/   # View (Widget) — screens/ widgets/
├── viewmodels/     # ViewModel — *_viewmodel.dart
├── data/
│   ├── models/         # データクラス + copyWith
│   ├── repositories/   # インターフェース + Impl
│   └── sources/        # mock_data.dart
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

### 2. Repository

[`templates/repository.dart`](templates/repository.dart) を参考に `lib/data/repositories/<entity>_repository.dart` を作成。

- `abstract class <Entity>Repository` + `class <Entity>RepositoryImpl implements <Entity>Repository`
- 現状はモック実装 (`mock_data.dart` を呼ぶか、ローカルの `List` を持つ)
- 疑似遅延 `await Future.delayed(const Duration(milliseconds: 400))` を入れて UI のローディングを再現

### 3. Provider 登録

[`lib/providers/providers.dart`](../../../junc_hamburger_club_mobile/lib/providers/providers.dart) の "Repositories" セクションに 1 行追加:

```dart
final myEntityRepositoryProvider = Provider<MyEntityRepository>(
  (ref) => MyEntityRepositoryImpl(),
);
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
- エラーは State にフィールドとして持つ (`String? error`)

### 5. Screen

[`templates/screen.dart`](templates/screen.dart) を参考に `lib/presentation/screens/<feature>/<name>_screen.dart` を作成。

- 子 Widget からも provider を読むなら `ConsumerWidget`、状態を持つなら `ConsumerStatefulWidget`
- AsyncValue は `state.when(data: ..., loading: () => const ShimmerLoading(), error: (e, _) => _ErrorView(e))` のパターンで捌く
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

# iOS シミュレータで起動確認
flutter run -d "iPhone 17 Pro Max" --dart-define=API_HOST=localhost

# Android エミュレータ
flutter run -d emulator-5556 --dart-define=API_HOST=10.0.2.2
```

## 最終チェックリスト

- [ ] `freezed` / `@riverpod` / `StateNotifier` を使っていない
- [ ] `state.valueOrNull` を使っていない (`state.value` を使う)
- [ ] `AsyncNotifier.build()` の中で `AsyncValue.guard` を呼んでいない
- [ ] Model に `copyWith` / `fromJson` / `toJson` / `==` / `hashCode` が揃っている
- [ ] Repository は abstract + Impl の形式
- [ ] Provider を `providers.dart` に追加した
- [ ] ViewModel の State クラスが immutable + `copyWith`
- [ ] Screen の色が `AppColors.*` 経由 (hex ハードコードなし)
- [ ] Router 登録済み
- [ ] `flutter analyze` ゼロエラー
- [ ] 実機/シミュレータで起動確認した

## E2E テスト追加

新しい TextField や操作を Maestro で検証する場合は、必要最小限の `Semantics(identifier: '...')` を付ける方針。詳しくは `maestro-e2e-flow` Skill を参照。
