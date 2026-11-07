# CLAUDE.md — バックエンド (user-api + admin-api + MySQL)

Docker Compose で動く 3 サービス構成。詳細は [`../README.md`](../README.md) §6 と [`../architecture_guideline.md`](../architecture_guideline.md) §5 を参照。

## サービス構成

| サービス | 技術 | ポート (host → container) | コンテナ名 |
|---|---|---|---|
| `user-api` | TypeScript + Express + mysql2 | 3100 → 3000 | `junc_user_api` |
| `admin-api` | Go 1.22 + Gin + go-sql-driver | 8080 → 8080 | `junc_admin_api` |
| `mysql` | MySQL 8.0 | 3307 → 3306 | `junc_mysql` |

**両 API は同じ MySQL / 同じスキーマを共有している**。モデル/型を変える時は必ず両側 (TS の `user-api/src/` と Go の `admin-api/models/`) と `init-db/01_schema.sql` をセットで更新すること。

## 起動・停止

```bash
cp .env.example .env            # 初回のみ

docker compose up -d --build    # 初回ビルド & 起動 (healthcheck で user-api/admin-api は mysql 完了を待つ)
docker compose ps
docker compose logs -f user-api

docker compose down             # 停止 (データは保持)
docker compose down -v          # ボリューム削除 (次回起動で init-db/*.sql が再適用される)
```

## init-db の挙動と文字化け回避

`init-db/01_schema.sql`, `init-db/02_seed_data.sql` は **MySQL ボリュームが空のときだけ** 実行される。既存ボリュームに再適用したい場合は `docker compose down -v` でボリュームごと落とす。

**重要**: seed/schema SQL の先頭には必ず

```sql
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
```

を書くこと。書き忘れると接続デフォルト (MySQL 8 では latin1) で UTF-8 バイトが投入され、日本語が壊れたまま保存される。

TypeScript 側 (`user-api/src/config/database.ts`) の mysql2 pool にも `charset: 'utf8mb4'` を明示している。Go 側 (`admin-api/config/config.go`) は DSN に `charset=utf8mb4` を入れている。どちらも外さない。

## 動作確認

```bash
curl http://localhost:3100/health              # => {"status":"ok","service":"junc-user-api"}
curl http://localhost:8080/health              # => {"status":"ok","service":"junc-admin-api"}
curl http://localhost:3100/api/v1/burgers | jq '.data.burgers | length'   # => 20
```

- User API Swagger UI: http://localhost:3100/api-docs
- OpenAPI 仕様: `user-api/swagger/openapi.yaml` / `admin-api/docs/swagger.yaml`

## やらないこと

- **`docker-compose.yml` を許可なく変更しない**。ポート競合は競合側のコンテナを止めて解決する
- 稼働中コンテナに直接 `ALTER TABLE` などを打たない。必ず `init-db/*.sql` を更新してボリューム再作成
- `.env` と `.env.local` はコミットしない (`.env.example` のみコミット)
- `--no-verify` などフックスキップは行わない

## 認証

- user-api JWT 有効期限: **7 日**
- admin-api JWT 有効期限: **24 時間**
- どちらも HS256 / 秘密鍵は `JWT_SECRET` 環境変数
