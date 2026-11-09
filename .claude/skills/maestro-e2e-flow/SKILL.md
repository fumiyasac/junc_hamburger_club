---
name: maestro-e2e-flow
description: verification_manual.md の検証項目や新機能の受け入れテストを Maestro E2E フローとして .maestro/ 配下に追加するとき、appId / subflow / 待ち方の既存規約と現状モック駆動の制約に揃える。「E2E を追加」「Maestro フロー」「iOS の自動テスト」「verification_manual の項目をテスト化」などの依頼で使用する。
---

# Maestro E2E フロー追加の手順

モバイルアプリの E2E は [Maestro](https://maestro.mobile.dev/) を使い、`.maestro/` 配下に YAML フローを配置する。詳細は [`junc_hamburger_club_mobile/CLAUDE.md`](../../../junc_hamburger_club_mobile/CLAUDE.md) 下部の「E2E テスト (Maestro)」セクションを参照。

**Playwright は現在未導入**。Web の E2E が必要な場合は別タスクで Playwright 導入を先に行う必要がある (本 Skill の対象外)。

## 現状の重要な前提

- **Repository は全てモック実装**。Maestro テストはモック駆動のアプリに対して動作し、バックエンド (`docker compose up`) は不要
- `launchApp: clearState: true` で各フロー間の状態リセット可能 (モック Repository のインメモリ状態もプロセス再起動で消える)
- クライアント側バリデーション (`register_screen.dart` 内の正規表現など) をテストできる
- 実 API 接続に切り替えた際は本 Skill のルールにメール重複対策・DB cleanup 等を追加する必要あり

## ディレクトリ構成

```
.maestro/
├── config.yaml                           # appId + executionOrder
├── flows/
│   ├── happy_path.yaml
│   ├── invalid_email.yaml
│   └── short_password.yaml
└── subflows/
    ├── onboarding_to_register.yaml
    └── fill_register_form.yaml
```

- `flows/*.yaml`: 独立実行可能なテストケース 1 本 = 1 ファイル
- `subflows/*.yaml`: 複数フローで共有する操作列
- appId: `com.junc.juncHamburgerClub` (iOS Runner.xcodeproj より)

## 要素特定の方針

| 対象 | 推奨する指定 |
|---|---|
| ボタン・タブ・リンク | **可視テキストで `tapOn: "<日本語ラベル>"`** |
| 絵文字入りラベル | そのまま `tapOn: "🍔\nカテゴリ"` 等 (Flutter の Column で改行表示されるものは `\n` を含める) |
| TextField | `Semantics(identifier: '...')` を付けて `tapOn: { id: '...' }` |
| 動的テキスト (価格など) | prefix 一致は Maestro のテキストマッチが部分一致なので可。確定的な文字列部分で tap |

**新しい TextField を触る場合**: Dart 側で `Semantics(identifier: '...', child: TextFormField(...))` を追加。[`register_screen.dart`](../../../junc_hamburger_club_mobile/lib/presentation/screens/onboarding/register_screen.dart) の `_InputField` パターンに倣って `identifier` prop を渡す形にする。

既存の identifier:
- `register_name_field` / `register_email_field` / `register_password_field` / `register_confirm_password_field`

## 待機の原則

- **`sleep` を書かない**。すべて `extendedWaitUntil: visible: ...` + `timeout: <ms>` で画面要素の出現を待つ
- 遷移直後の操作は、遷移先に特有のテキストが見えるまで待ってから次へ進める
- 操作後にローディング画面が出るケース: ローディングテキスト消失ではなく、**次の画面のテキスト出現**を待つ

## テストデータのユニーク化

モック UserRepository は登録済みメールの重複をエラーにする。登録フローは毎回ユニークなメールを使う:

```yaml
- evalScript: ${output.email = 'e2e-' + Date.now() + '@example.com'}
- inputText: ${output.email}
```

パスワード等の固定値は OK。氏名も固定値で問題ない。

## 作業順序

### 1. 既存フローとサブフローの確認

- 類似の操作列があれば `subflows/` に切り出せないか検討
- `.maestro/subflows/onboarding_to_register.yaml` と `fill_register_form.yaml` は既にあるので再利用する

### 2. 新規フロー作成

[`templates/flow.yaml`](templates/flow.yaml) を雛形に `.maestro/flows/<name>.yaml` を作成。

必須の冒頭:

```yaml
appId: com.junc.juncHamburgerClub
name: <flow_name>
---
- launchApp:
    clearState: true
    clearKeychain: true
```

### 3. 共通操作を subflow に切り出す

複数フローで同じ手順を繰り返す場合は `.maestro/subflows/<name>.yaml` に切り出し、`runFlow: ../subflows/<name>.yaml` で呼ぶ。パラメータは `evalScript: ${output.xxx = ...}` でセットして subflow 内で `${output.xxx}` を参照。[`templates/subflow.yaml`](templates/subflow.yaml) 参照。

### 4. config.yaml の実行順序を調整 (必要に応じて)

`.maestro/config.yaml` の `executionOrder.flowsOrder` に追加。デフォルトでは `maestro test .maestro` で全フローが指定順に実行される。

### 5. アプリ側の識別子追加 (TextField を触る場合のみ)

- `Semantics(identifier: '...', child: TextFormField(...))` を追加
- 命名は `<screen>_<field>_field` 形式 (例: `review_comment_field`)
- Semantics を増やすため `flutter analyze` を必ず確認

### 6. 実行して確認

```bash
# 事前: Maestro CLI インストール (未済の場合)
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$PATH":"$HOME/.maestro/bin"

# iOS シミュレータでアプリを起動
open -a Simulator
flutter run -d "iPhone 17 Pro Max" --dart-define=API_HOST=localhost
# ホットリロードは不要なので q で停止、アプリは残る

# フロー実行
maestro test .maestro/flows/<new_flow>.yaml

# 全フロー
maestro test .maestro
```

## 最終チェックリスト

- [ ] 先頭で `launchApp: clearState: true` を実行している
- [ ] 要素特定は visible text を優先、TextField のみ `id:`
- [ ] 固定 `sleep` を使っていない (`extendedWaitUntil` のみ)
- [ ] テストメール等のユニーク化が必要なら `evalScript: Date.now()` パターン
- [ ] 複数フローで繰り返す操作は subflow に切り出した
- [ ] 新規 TextField に触るなら Dart 側に `Semantics(identifier: '...')` を追加
- [ ] `flutter analyze` で警告ゼロ (Semantics 追加の影響確認)
- [ ] iOS シミュレータで `maestro test` が green
- [ ] `config.yaml` の `executionOrder.flowsOrder` を更新したか (全フロー実行時の順序に影響)

## 禁止事項

- **固定 sleep の使用** (`- waitForAnimationToEnd` や `- extendedWaitUntil` を使う)
- **座標指定 (`tapOn: { point: '50%, 50%' }`)** — UI 変更に脆い
- **モック依存の挙動 (特定の burger ID が常に存在する等) に強く依存したフロー** — 実 API 切替時に全崩壊する
- **Playwright フローをここに追加しようとする** — Playwright は未導入
