---
name: db-schema-change
description: MySQL スキーマ (junc_hamburger_club_backend/init-db/01_schema.sql) を変更するとき、seed データ・user-api と admin-api の両モデル・両コントローラ/ハンドラ・両クライアント型を漏れなく同期させる。「テーブルを追加」「カラム追加」「スキーマ変更」「seed データを変える」「DB の列を増やす」などの依頼で使用する。
---

# DB スキーマ変更の手順

このリポジトリは **user-api (TS) と admin-api (Go) が同じ MySQL / 同じスキーマを共有** している。スキーマ変更を片方だけ追従させると即座に壊れる。順序と漏れ防止のためのチェックリストを厳守する。

前提は [`junc_hamburger_club_backend/CLAUDE.md`](../../../junc_hamburger_club_backend/CLAUDE.md) 参照。

## 絶対に守る

- **稼働中コンテナに ALTER TABLE を直接打たない**。必ず `init-db/01_schema.sql` を更新し、`docker compose down -v` でボリュームごと作り直して再 seed
- **SQL ファイルの先頭に `SET NAMES utf8mb4; SET CHARACTER SET utf8mb4;` を書く** (書かないと日本語データが MySQL 8 の latin1 接続で文字化け)
- **`docker-compose.yml` は許可なく変更しない**

## 作業順序

### 1. スキーマファイルを更新

[`junc_hamburger_club_backend/init-db/01_schema.sql`](../../../junc_hamburger_club_backend/init-db/01_schema.sql)

- 既存テーブルは `CREATE TABLE IF NOT EXISTS` + `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` 統一
- FK は `CONSTRAINT fk_<table>_<col> FOREIGN KEY (col) REFERENCES <ref>(id) [ON DELETE CASCADE]`
- タイムスタンプは `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` / `updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
- 論理削除は `is_active BOOLEAN NOT NULL DEFAULT TRUE`

### 2. seed データを更新

[`junc_hamburger_club_backend/init-db/02_seed_data.sql`](../../../junc_hamburger_club_backend/init-db/02_seed_data.sql)

- 先頭の `SET NAMES utf8mb4;` が残っているか確認
- 新テーブル向けの INSERT を追加。日本語が含まれる場合は特に接続 charset 注意
- 既存 20 バーガー等との整合性 (外部キー、カテゴリ ID の存在) を保つ

### 3. user-api 側の同期

| 対象 | 変更内容 |
|---|---|
| [`src/types/index.ts`](../../../junc_hamburger_club_backend/user-api/src/types/index.ts) | 新/変更列に対応する `<Entity>Row` 型 (snake_case) |
| [`src/controllers/<topic>.controller.ts`](../../../junc_hamburger_club_backend/user-api/src/controllers/) | `format<Entity>()` と各ハンドラの `SELECT` 列順を更新 |
| [`swagger/openapi.yaml`](../../../junc_hamburger_club_backend/user-api/swagger/openapi.yaml) | `components.schemas.<Entity>` を同じ形で更新 |

**JSON 契約**: ID は `String(row.id)` で文字列化。DECIMAL は `parseFloat()`。BOOLEAN は `Boolean()`。

### 4. admin-api 側の同期

| 対象 | 変更内容 |
|---|---|
| [`models/models.go`](../../../junc_hamburger_club_backend/admin-api/models/models.go) | struct フィールド。`int` ID は `json:"id,string"` タグ必須 |
| [`handlers/<topic>.go`](../../../junc_hamburger_club_backend/admin-api/handlers/) | `rows.Scan(...)` の列順、INSERT / UPDATE の列名 |
| [`docs/swagger.yaml`](../../../junc_hamburger_club_backend/admin-api/docs/swagger.yaml) | 同じ Entity schema を更新 |

**モデル struct の順序**: `rows.Scan` に渡す順番と `SELECT` 列順を**完全に一致**させる (Scan はインデックス順)。

### 5. クライアント型の同期

- webfront: [`src/lib/types.ts`](../../../junc_hamburger_club_webfront/src/lib/types.ts) の interface を更新
- Flutter: [`lib/data/models/<entity>.dart`](../../../junc_hamburger_club_mobile/lib/data/models/) の class、`fromJson` / `toJson` / `copyWith` を更新 (camelCase)

Flutter の `freezed` は使わないので手書きで全プロパティ追加。

### 6. モックデータの追従

[`junc_hamburger_club_mobile/lib/data/sources/mock_data.dart`](../../../junc_hamburger_club_mobile/lib/data/sources/mock_data.dart)

現状 Flutter は実 API ではなくモック駆動 (`CLAUDE.md` 「既知の不一致」参照)。モデルに新フィールドが増えたら、mock_data の初期値も合わせて更新する。欠けたフィールドがあるとランタイムで `TypeError` になる。

### 7. 再起動と疎通確認

```bash
cd junc_hamburger_club_backend

# データボリュームを捨てて再 seed
docker compose down -v
docker compose up -d --build
docker compose logs -f mysql user-api   # init-db の適用ログを確認

# 疎通
curl -s http://localhost:3100/api/v1/<topic> | jq
# 日本語が化けていないかを目視確認
```

## 最終チェックリスト

- [ ] `01_schema.sql` に `SET NAMES utf8mb4` ヘッダがある
- [ ] `02_seed_data.sql` に `SET NAMES utf8mb4` ヘッダがある
- [ ] 新/変更カラムが DB 側 (snake_case)、JSON 側 (camelCase) で正しく対応している
- [ ] user-api の `<Entity>Row` 型を更新した
- [ ] user-api の `format<Entity>()` と SELECT 列順を揃えた
- [ ] admin-api の `models/models.go` struct に ID の `,string` タグがある
- [ ] admin-api の `rows.Scan` の列順と SELECT 列順を完全一致させた
- [ ] 両 API の OpenAPI (`openapi.yaml` / `swagger.yaml`) を更新した
- [ ] webfront `types.ts` を更新した
- [ ] Flutter `data/models/*.dart` を手書き更新した (freezed 禁止)
- [ ] `mock_data.dart` の初期値を更新した (Flutter がモック駆動のため)
- [ ] `docker compose down -v && docker compose up -d --build` で再起動した
- [ ] curl で `GET /<topic>` の日本語データが化けていないことを確認した

## ロールバック

誤ったスキーマを適用して DB が壊れた場合:

```bash
docker compose down -v        # ボリュームごと破棄
git checkout -- junc_hamburger_club_backend/init-db/   # SQL を戻す
docker compose up -d --build  # 再 seed
```

ローカルの開発データは消えるが、本リポジトリは mock/seed ベースなので再現できる。本番データ想定の運用はしない。
