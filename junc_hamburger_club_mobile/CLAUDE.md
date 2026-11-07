# CLAUDE.md — Flutter モバイルアプリ

Flutter 3.x / Riverpod 3.x / MVVM / GoRouter 14.x。詳細な設計解説は [`../architecture_guideline.md`](../architecture_guideline.md) §2, §3, §10 に全て書かれているので、本ファイルは実装者が踏みやすい地雷の回避に集中する。

## 絶対に使わないもの

| 禁止 | 代わりに使うもの |
|---|---|
| `freezed` | 手書き `copyWith` を持つ通常クラス |
| `@riverpod` / `build_runner` によるコード生成 | `NotifierProvider` / `AsyncNotifierProvider` を手動定義 |
| `StateNotifier` | `Notifier` / `AsyncNotifier` (Riverpod 3.x) |
| `state.valueOrNull` | `state.value` (`valueOrNull` は 3.x で削除) |
| `build()` 内での `AsyncValue.guard(() => build())` | `build()` は直接 await を書き、`guard()` は `refresh()` 等の別メソッドでのみ使う |

## ディレクトリ対応 (MVVM)

```
lib/
├── presentation/   # View (Widget) — screens/ widgets/
├── viewmodels/     # ViewModel — *_viewmodel.dart
├── data/
│   ├── models/         # データクラス + copyWith
│   ├── repositories/   # インターフェース + Impl
│   └── sources/        # mock_data.dart (現状の実データ源)
├── providers/      # Riverpod Provider 定義 (providers.dart に集約)
└── core/           # constants / router / services / theme
```

**現状**: Repository 実装は `data/sources/mock_data.dart` を返す。Dio は `pubspec.yaml` に入っているが未配線。実 API 呼び出しに切り替える場合は Repository Impl 側の差し替えで完結させ、ViewModel には触らないこと。

## Provider の使い分け

| 用途 | Provider |
|---|---|
| 同期的な状態 (カート・認証・検索クエリ) | `NotifierProvider<VM, State>` |
| 非同期データ (API 風データ取得) | `AsyncNotifierProvider<VM, State>` |
| 読み取り専用の単一インスタンス (Repository) | `Provider` |

## 常用コマンド

```bash
flutter pub get
flutter doctor -v
flutter devices

# iOS シミュレータ (localhost で user-api に直通)
flutter run -d "iPhone 17 Pro Max" --dart-define=API_HOST=localhost

# Android エミュレータ (10.0.2.2 がホストマシン)
flutter run -d emulator-5556 --dart-define=API_HOST=10.0.2.2
```

`API_HOST` は `lib/core/constants/api_constants.dart` で `String.fromEnvironment` 経由で解決される。デフォルトは `10.0.2.2`。

## その他の注意

- UI は Material 3 + Google Fonts (Nunito)。カラーは `core/theme/` の `AppColors` を使い、ハードコードしない
- ルーティングは `core/router/` の GoRouter + ShellRoute。ボトムナビは ShellRoute が担当するので、各画面側に BottomNavigationBar を持たせない
- トラブルシューティングは [`../README.md`](../README.md) §13 を参照
