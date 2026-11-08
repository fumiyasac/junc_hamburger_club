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

## E2E テスト (Maestro)

`.maestro/` 配下に Maestro フローを配置している (リポジトリルート直下)。現在のフロー:

- `happy_path` — オンボーディング → 新規登録 → バーガー詳細 → カート追加 → 注文確定 → 注文完了
- `invalid_email` — @ を含まないメールでバリデーションエラー
- `short_password` — 7 文字パスワードでバリデーションエラー

**重要**: 現在 Repository は全てモック実装 (詳細は上部 "現状" 節)。したがって Maestro テストは **モック駆動のアプリに対して動作** する。バックエンド起動は不要。実 API 接続に切り替えた際はフロー側に認証 API のレート/重複対策が必要。

### セットアップ

```bash
# Maestro CLI (初回のみ)
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH":"$HOME/.maestro/bin"

# iOS シミュレータを起動 & アプリを (debug で) インストール
open -a Simulator
flutter run -d "iPhone 17 Pro Max" --dart-define=API_HOST=localhost
# アプリが立ち上がったら一度停止 (q)。シミュレータにアプリは残る。
```

### 実行

```bash
# リポジトリルートから。1 本ずつ実行する場合:
maestro test .maestro/flows/happy_path.yaml
maestro test .maestro/flows/invalid_email.yaml
maestro test .maestro/flows/short_password.yaml

# 全フロー (config.yaml の executionOrder に従う):
maestro test .maestro
```

各フローは先頭で `launchApp: clearState: true` を実行するため、前のフローの状態は引き継がない。

### フローから要素を特定する方針

- **できる限り visible text で特定する** (日本語ラベル・絵文字入りボタン名など)
- テキスト欄 (`TextFormField`) のみ `Semantics(identifier: '...')` を付与して `id:` 指定でタップする。現状の識別子:
  - `register_name_field` / `register_email_field` / `register_password_field` / `register_confirm_password_field`
- 固定 `sleep` を書かず、`extendedWaitUntil: visible: ...` で状態を待つ
- テストデータは `evalScript: ${output.email = 'e2e-' + Date.now() + '@example.com'}` で実行毎にユニーク化する (モック Repository の重複登録エラー回避)
