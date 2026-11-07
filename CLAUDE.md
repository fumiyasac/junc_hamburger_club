# CLAUDE.md — JUNC Hamburger Club モノレポ

AI コーディングエージェント向けのプロジェクトコンテキスト。詳細は各既存ドキュメントに委ねるので、本ファイルでは "最低限これだけは守る" を記す。

## 構成

このリポジトリは 4 コンポーネントから成る:

| ディレクトリ | 内容 | ポート (host → container) |
|---|---|---|
| `junc_hamburger_club_mobile/` | Flutter (Riverpod 3.x / MVVM / GoRouter 14) | — |
| `junc_hamburger_club_backend/user-api/` | TypeScript + Express | 3100 → 3000 |
| `junc_hamburger_club_backend/admin-api/` | Go + Gin | 8080 → 8080 |
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

## 既知の不一致 (ドキュメント ↔ 実コード)

以下は既存ドキュメントの記述とリポジトリ現状の差分。作業時は **実コード側を正** とし、推測で埋めないこと。

1. **Next.js ポート**: `architecture_guideline.md` §1 の図は `Port 3001` だが、実際は **3002** (`webfront/package.json` の `next dev -p 3002`, README §7 とも)
2. **`guidance.md`**: `architecture_guideline.md` §9 のファイルマップに記載があるが、現在リポジトリに存在しない
3. **Flutter のデータソース**: `pubspec.yaml` に Dio があり README §3 でも Dio 使用を謳うが、`mobile/lib/data/repositories/*.dart` の現行実装は `mock_data.dart` を返す構成で、user-api への実 HTTP 通信は未配線 (モック駆動)
