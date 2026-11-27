# CLAUDE.md — JUNC Hamburger Club モノレポ

AI コーディングエージェント向けのプロジェクトコンテキスト。詳細は各既存ドキュメントに委ねるので、本ファイルでは "最低限これだけは守る" を記す。

## 構成

このリポジトリは 4 コンポーネントから成る:

| ディレクトリ | 内容 | ポート (host → container) |
|---|---|---|
| `junc_hamburger_club_mobile/` | Flutter (Riverpod 3.x / MVVM / GoRouter 14) | — |
| `junc_hamburger_club_backend/user-api/` | TypeScript + Express | 3100 → 3000 |
| `junc_hamburger_club_backend/admin-api/` | Go + Gin | 8081 → 8080 |
| `junc_hamburger_club_backend/` (MySQL 8.0) | 両 API が共有する唯一の DB | 3307 → 3306 |
| `junc_hamburger_club_webfront/` | Next.js 15 (App Router) + Tailwind 3 | 3002 |

**最重要の関係**: `user-api` (TS) と `admin-api` (Go) は **同じ MySQL / 同じスキーマを共有** している。スキーマ変更は必ず `junc_hamburger_club_backend/init-db/01_schema.sql` 経由で行い、両 API のモデル定義もセットで更新すること。

## 共通規約

- **デザインシステム**: Primary `#FF6B6B` / Secondary `#FFD93D` / Accent `#6BCB77` / Background `#FFF8F8` / フォント **Nunito**。mobile / webfront で揃える
- **環境変数**: 各サブプロジェクトに `.env.example` / `.env.local.example` を置き、実値は `.env` / `.env.local` に書く (git 管理外)
- **`docker-compose.yml` は許可なく変更しない**: ポート競合は compose ではなく競合側のコンテナ停止で解決する方針
- 変更作業は `feature/<topic>` ブランチを `main` から切って行う

## サブディレクトリ CLAUDE.md

スタック固有の規約・常用コマンド・禁止事項は各ディレクトリの CLAUDE.md を参照:

- [`junc_hamburger_club_mobile/CLAUDE.md`](junc_hamburger_club_mobile/CLAUDE.md) — Flutter / Riverpod 3.x の禁止事項
- [`junc_hamburger_club_backend/CLAUDE.md`](junc_hamburger_club_backend/CLAUDE.md) — Docker 起動、文字化け回避、2 API / 1 MySQL
- [`junc_hamburger_club_webfront/CLAUDE.md`](junc_hamburger_club_webfront/CLAUDE.md) — App Router / Tailwind / 画像解決

## 既存ドキュメントへの入口

- [`README.md`](README.md) — セットアップ・API 仕様・トラブルシューティング (詳細はここ)
- [`architecture_guideline.md`](architecture_guideline.md) — アーキ全体図 / MVVM / Riverpod / DB ER 図
- [`procedure_manual.md`](procedure_manual.md) — 環境構築手順書
- [`verification_manual.md`](verification_manual.md) — 検証手順書

## 推奨ワークフロー (Skills + Subagents)

このリポジトリには `.claude/skills/` (作業手順の定型) と `.claude/agents/` (レビュー・作成を担う Subagent) が用意されている。両者を組み合わせた標準的な進め方:

### 1. 作業中: Skill で実装

機能実装・変更の中心となる Skill を呼ぶ:
- API 追加/変更 → `api-endpoint-change`
- スキーマ変更 → `db-schema-change`
- Flutter 新機能 → `flutter-feature` (抽象 + Api + Mock の 3 層 Repository)
- Flutter の実 API 配線 (Dio Interceptor / 自動 refresh / ApiException) → `flutter-api-integration`
- 管理画面ページ → `admin-page`
- E2E テスト追加 (Flutter) → `maestro-e2e-flow` (または `e2e-test-writer`)
- E2E テスト追加 (Next.js) → `playwright-e2e-flow` (または `e2e-test-writer`)

### 1.5. 開発環境 + 疎通確認の運用

- ローカル起動・migration 適用・テストトークン取得 → **`local-dev-env`** (`scripts/dev-up.sh` 等)
- 主要業務フローの通し検証 → **`api-smoke-test`** (`scripts/smoke.sh`)

PR の完了条件や実装直後の回帰確認では `scripts/smoke.sh` を回す。

### 2. 実装完了直後: 検証ランナー

- **`verification-runner`** (読み取り/コマンド実行のみ、編集なし): `git diff` で変更があったコンポーネントだけ、CI (`.github/workflows/`) と同じコマンド (lint / 型 / テスト / ビルド) を実行し、**失敗だけ末尾 30 行で要約**して返す。バックエンドが起動していれば `scripts/smoke.sh` も実行。
  - PR の完了条件の一次チェックに使う。大量ログをメイン会話に持ち込まないのが目的。

### 3. PR 作成前: レビュー Subagent を並行実行

`.claude/agents/` のレビュー 5 本は **読み取り専用**。差分を監査して統一フォーマットで指摘を返す:

- **`api-contract-reviewer`**: OpenAPI ↔ 実装 ↔ 両クライアントの整合 + #65 統一エラー形式 + `docs/error_codes.md` + Idempotency-Key 判定
- **`cross-stack-impact-analyzer`**: 共有 MySQL / 2 API / 2 クライアントへの波及、#54 pickup_slot_counters / #56 オプション snapshot / #65 idempotency_keys / ステータス遷移 3-source
- **`security-reviewer`**: JWT / 認可 / SQL / 入力検証 / シークレット + #66 refresh token (ハッシュ保存・ローテ・再利用検知・family 失効・sid 失効チェック・rate limit) + Flutter トークン保存
- **`flutter-reviewer`**: Flutter 固有 (Riverpod 3.x 禁止事項 / context.mounted / AsyncValue 3 状態 / ApiException 分岐 / Semantics / トークン保存漏洩)

指摘があれば修正して再度レビューを回す。

### 4. ドキュメント整合性チェック

- **`docs-sync-checker`** (読み取り専用): 差分と README / verification_manual / `docs/error_codes.md` / 各 CLAUDE.md / **`.claude/skills/*/SKILL.md` とテンプレート** の乖離を検出。特に Skill drift (古い Skill で次の作業者がバグを量産するリスク) を重点確認。

### 5. 受け入れテスト

- **`e2e-test-writer`** (編集可) に Maestro フロー作成を依頼。Mock モード (既存) / Api モード (実配線後、`./scripts/dev-up.sh` 前提) を明示して渡す。

### シナリオ別の典型組み合わせ

全シナリオ共通で、実装完了直後に **`verification-runner`** を回し、PR 作成直前に **`docs-sync-checker`** を回す。以下はそれに加えて並行実行する Subagent:

| シナリオ | Skill | 並行レビュー Subagent |
|---|---|---|
| 新規エンドポイント | `api-endpoint-change` → `api-smoke-test` | `api-contract-reviewer` + `cross-stack-impact-analyzer` + (認証変更あれば `security-reviewer`) |
| スキーマ変更 | `db-schema-change` → `api-smoke-test` | `cross-stack-impact-analyzer` (必須) + `api-contract-reviewer` |
| Flutter 新機能 | `flutter-feature` | **`flutter-reviewer`** + `cross-stack-impact-analyzer` (fromJson と API の整合) |
| Flutter 実 API 配線 | `flutter-api-integration` + `local-dev-env` | **`flutter-reviewer`** + `cross-stack-impact-analyzer` + `security-reviewer` (トークン保存) |
| 管理画面ページ | `admin-page` | `security-reviewer` (管理 API 認可) + `api-contract-reviewer` |
| 認証・権限変更 | `api-endpoint-change` → `api-smoke-test` | **`security-reviewer` 必須** |
| 注文フロー改修 | `api-endpoint-change` → `api-smoke-test` | `cross-stack-impact-analyzer` (注文観点) + `security-reviewer` (認可) |
| 環境トラブル | `local-dev-env` | — |
| 受け入れテスト追加 | — | `e2e-test-writer` |

### 出力フォーマット
レビュー Subagent は以下の統一フォーマットで返す:
- 重大度別 (🔴 高 / 🟠 中 / 🟡 低)
- 場所 (`path/to/file:LINE`)
- 問題の内容
- 修正案 (どのファイルをどう直すか、仕様 or 実装 のどちらを正とするか)
- 追加で確認を推奨する点 (人間判断に委ねる論点)

---

## 既知の不一致 (ドキュメント ↔ 実コード)

以下は既存ドキュメントの記述とリポジトリ現状の差分。作業時は **実コード側を正** とし、推測で埋めないこと。

1. **Next.js ポート**: `architecture_guideline.md` §1 の図は `Port 3001` だが、実際は **3002** (`webfront/package.json` の `next dev -p 3002`, README §7 とも)
2. **`guidance.md`**: `architecture_guideline.md` §9 のファイルマップに記載があるが、現在リポジトリに存在しない
3. **Flutter のデータソース**: `pubspec.yaml` に Dio があり README §3 でも Dio 使用を謳うが、`mobile/lib/data/repositories/*.dart` の現行実装は `mock_data.dart` を返す構成で、user-api への実 HTTP 通信は未配線 (モック駆動)。実 API 配線は `flutter-api-integration` Skill に設計がまとめてあり、順次差し替え予定 (抽象 + Api 実装 + Mock 実装の 3 層化)
