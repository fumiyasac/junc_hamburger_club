---
name: db-schema-change
description: MySQL スキーマを変更するとき、新規環境向けの init-db/01_schema.sql + seed データと、既存ボリューム向けの冪等マイグレーション (init-db/0N_*_migration.sql) を同時に用意し、user-api と admin-api の両モデル・両コントローラ/ハンドラ・両クライアント型を漏れなく同期させる。「テーブルを追加」「カラム追加」「スキーマ変更」「seed データを変える」「DB の列を増やす」「マイグレーションを書く」などの依頼で使用する。
---

# DB スキーマ変更の手順

このリポジトリは **user-api (TS) と admin-api (Go) が同じ MySQL / 同じスキーマを共有** している。スキーマ変更を片方だけ追従させると即座に壊れる。順序と漏れ防止のためのチェックリストを厳守する。

前提: [`junc_hamburger_club_backend/CLAUDE.md`](../../../junc_hamburger_club_backend/CLAUDE.md)

## 絶対に守る

- **稼働中コンテナに `ALTER TABLE` を直接打たない**。必ず SQL ファイルを更新する
- **SQL ファイルの先頭に `SET NAMES utf8mb4; SET CHARACTER SET utf8mb4;` を書く** (MySQL 8 の latin1 接続で日本語が文字化けする)
- **`docker-compose.yml` は許可なく変更しない**

## init-db の構成と番号付け規則

`junc_hamburger_club_backend/init-db/` の SQL は **ファイル名の辞書順** で MySQL 起動時に実行される (volume が空のときのみ)。現在の構成:

```
01_schema.sql                      — 新規環境の全テーブル定義 (正本)
02_seed_data.sql                   — 新規環境の初期データ (正本)
03_news_migration.sql              — 既存ボリューム向け: news 追加 (PR #53)
04_pickup_slot_migration.sql       — 同: pickup_slot_counters (PR #54)
05_options_migration.sql           — 同: options 系 4 テーブル (PR #56)
06_idempotency.sql                 — 同: idempotency_keys (PR #65)
07_app_config.sql                  — 同: app_config (PR #65)
08_refresh_sessions.sql            — 同: refresh_sessions (PR #66)
```

**番号付けルール**:

| 番号帯 | 用途 |
|---|---|
| `01_` / `02_` | 新規環境向けのスキーマ全体・seed 全体 (正本)。**常にここも更新** |
| `0N_<feature>_migration.sql` (N は 03 以降の最大 +1) | 既存ボリュームに後付けで適用する冪等スクリプト |

既存環境のユーザー (開発者のマシン、CI 等) は `down -v` をせずに `0N_*` を 1 回流して追従する。

## 2 系統を同時に用意する

スキーマを変える時は **必ず両方を更新**:

1. **新規環境向け** (`01_schema.sql` + `02_seed_data.sql`): `CREATE TABLE ...` / `INSERT INTO ...` を追記
2. **既存環境向け** (`0N_<feature>_migration.sql`): 以下のパターンで冪等に書く

### 冪等 migration の書き方

```sql
-- 08_refresh_sessions.sql の例
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- CREATE は IF NOT EXISTS で冪等
CREATE TABLE IF NOT EXISTS refresh_sessions (
  id CHAR(36) NOT NULL,
  ...
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ALTER は PREPARE/EXECUTE で冪等化 (05_options_migration.sql にパターンあり):
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cart_items' AND COLUMN_NAME = 'option_hash');
SET @sql := IF(@col = 0, 'ALTER TABLE cart_items ADD COLUMN option_hash VARCHAR(64) NOT NULL DEFAULT ""', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- INSERT は ON DUPLICATE KEY UPDATE で冪等
INSERT INTO <table> (...) VALUES (...)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
```

## 作業順序

### 1. `01_schema.sql` を更新 (新規環境の正本)

- 既存テーブルは `CREATE TABLE IF NOT EXISTS` + `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
- FK は `CONSTRAINT fk_<table>_<col> FOREIGN KEY (col) REFERENCES <ref>(id) [ON DELETE CASCADE]`
- タイムスタンプは `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` / `updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
- 論理削除は `is_active BOOLEAN NOT NULL DEFAULT TRUE`

### 2. `02_seed_data.sql` を更新 (必要なら)

- 先頭の `SET NAMES utf8mb4;` が残っているか確認
- 外部キー整合性を保つ

### 3. 既存ボリューム向け `0N_<feature>_migration.sql` を新規作成

ファイル名は既存の最大番号 + 1 (例: 現状最大は 08 → 次は `09_<feature>_migration.sql`)。

- 冒頭に `SET NAMES utf8mb4;` + 実行コマンドのコメント:
  ```sql
  -- 実行:
  --   docker compose exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  --     < junc_hamburger_club_backend/init-db/09_<feature>_migration.sql
  ```
- 内容は 01_schema.sql の該当部分と**完全に同じ結果になる** 冪等 SQL

### 4. user-api 側の同期

| 対象 | 変更内容 |
|---|---|
| [`src/types/index.ts`](../../../junc_hamburger_club_backend/user-api/src/types/index.ts) | 新/変更列に対応する `<Entity>Row` 型 (snake_case) |
| [`src/controllers/<topic>.controller.ts`](../../../junc_hamburger_club_backend/user-api/src/controllers/) | `format<Entity>()` と各ハンドラの `SELECT` 列順を更新 |
| [`swagger/openapi.yaml`](../../../junc_hamburger_club_backend/user-api/swagger/openapi.yaml) | `components.schemas.<Entity>` を同じ形で更新 |

**JSON 契約**: ID は `String(row.id)` で文字列化、DECIMAL は `parseFloat()`、BOOLEAN は `Boolean()`。

### 5. admin-api 側の同期

| 対象 | 変更内容 |
|---|---|
| [`models/models.go`](../../../junc_hamburger_club_backend/admin-api/models/models.go) | struct フィールド。`int` ID は `json:"id,string"` タグ必須 |
| [`handlers/<topic>.go`](../../../junc_hamburger_club_backend/admin-api/handlers/) | `rows.Scan(...)` の列順、INSERT / UPDATE の列名 |
| [`docs/swagger.yaml`](../../../junc_hamburger_club_backend/admin-api/docs/swagger.yaml) | 同じ Entity schema を更新 |

**モデル struct の順序**: `rows.Scan` に渡す順番と `SELECT` 列順を**完全に一致**させる (Scan はインデックス順)。

### 6. クライアント型の同期

- webfront: [`src/lib/types.ts`](../../../junc_hamburger_club_webfront/src/lib/types.ts) の interface を更新
- Flutter: [`lib/data/models/<entity>.dart`](../../../junc_hamburger_club_mobile/lib/data/models/) の class、`fromJson` / `toJson` / `copyWith` を更新 (camelCase)。`freezed` は使わない。
  また **Api 実装 (`<entity>_api_repository.dart`) と Mock 実装 (`<entity>_mock_repository.dart`) の両方** を忘れずに更新する (`flutter-api-integration` Skill 参照)

### 7. 適用と疎通確認

#### 手元のデータを捨てて作り直す場合

```bash
cd junc_hamburger_club_backend
docker compose down -v
docker compose up -d --build
docker compose logs -f mysql user-api
```

#### 手元のデータを保持して既存ボリュームに migration を流す場合

```bash
cd junc_hamburger_club_backend
docker compose exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < init-db/09_<feature>_migration.sql
# 新しい列・テーブルを参照する API が既に動いている場合は user-api / admin-api を再ビルド
docker compose up -d --build user-api admin-api
```

または `local-dev-env` Skill の `scripts/dev-migrate.sh` を使う。

#### 疎通

```bash
curl -s http://localhost:3100/api/v1/<topic> | jq
# 日本語が化けていないかを目視確認
```

## 最終チェックリスト

- [ ] `01_schema.sql` に新テーブル/新列を追加した (正本)
- [ ] `02_seed_data.sql` を更新した (必要なら)
- [ ] `0N_<feature>_migration.sql` を新規作成し冪等スクリプトにした
- [ ] 両ファイルに `SET NAMES utf8mb4` ヘッダがある
- [ ] user-api の `<Entity>Row` 型を更新した
- [ ] user-api の `format<Entity>()` と SELECT 列順を揃えた
- [ ] admin-api の `models/models.go` struct に ID の `,string` タグがある
- [ ] admin-api の `rows.Scan` の列順と SELECT 列順を完全一致させた
- [ ] 両 API の OpenAPI (`openapi.yaml` / `swagger.yaml`) を更新した
- [ ] webfront `types.ts` を更新した
- [ ] Flutter `data/models/*.dart` を手書き更新した (freezed 禁止)
- [ ] Flutter の `<entity>_api_repository.dart` と `<entity>_mock_repository.dart` 両方を更新した
- [ ] 既存ボリュームに migration を流して確認、または `down -v && up` で作り直した
- [ ] curl で `GET /<topic>` の日本語データが化けていないことを確認した

## ロールバック

### migration だけ戻す場合

冪等 migration は追加系のみ (`CREATE IF NOT EXISTS` / 列追加) なので DROP を書く逆方向 migration を用意する。手元の開発環境では `docker compose down -v` の方が早い。

### スキーマ全体を元に戻す場合

```bash
docker compose down -v
git checkout -- junc_hamburger_club_backend/init-db/
docker compose up -d --build
```

ローカルの開発データは消えるが、本リポジトリは mock/seed ベースなので再現できる。

## 禁止事項

- **既存の `01_schema.sql` の既存テーブル定義を破壊的に書き換えない** (新規環境は常に新規に作り直されるが、ユーザーの手元環境を考慮して**冪等 migration を別途用意するのが前提**)
- **稼働中コンテナに ALTER を直接打たない** (migration ファイル経由のみ)
- **本番運用では `down -v` を使わない** (このリポジトリは mock/seed 前提なのでローカルのみの話。本番相当の運用は別途設計が必要)
