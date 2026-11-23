---
name: local-dev-env
description: バックエンド (user-api + admin-api + MySQL) を docker compose で起動・migration 適用・テスト用トークン取得する手順と、Android エミュレータ (10.0.2.2) や init-db 再実行の罠を回避するスクリプト群。「ローカル開発環境を立ち上げ直す」「既存 DB に migration を適用」「テスト用のアクセストークンを取る」「docker compose が起動しない」「admin ログインできない」などの依頼で使用する。
---

# ローカル開発環境の起動と運用

docker compose + MySQL + user-api + admin-api の起動・migration 適用・テスト用トークン取得までを定型化する。シェルスクリプトは `scripts/` 配下。詳細な前提は [`junc_hamburger_club_backend/CLAUDE.md`](../../../junc_hamburger_club_backend/CLAUDE.md)。

## クイックリファレンス

| したいこと | コマンド |
|---|---|
| 初回 or 完全リセット | `./scripts/dev-reset.sh` |
| 既存ボリュームに未適用 migration を適用 | `./scripts/dev-migrate.sh` |
| 普通に起動 (既存ボリュームそのまま) | `./scripts/dev-up.sh` |
| テストユーザー自動登録 + accessToken 取得 | `source ./scripts/dev-login.sh` |
| 止める (データ保持) | `cd junc_hamburger_club_backend && docker compose down` |
| ボリュームごと破棄 | `cd junc_hamburger_club_backend && docker compose down -v` |

## 事前条件

- Docker Desktop が起動している
- `junc_hamburger_club_backend/.env` が存在 (無ければ `cp .env.example .env`)
- `.env` の `JWT_SECRET` が **32 文字以上** (短いと起動失敗、PR #66)
- `.env` の `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` が設定済み (初回は `.env.example` の値でそのまま `admin1234` でログイン可)

## スクリプト

### `scripts/dev-up.sh` — 起動 + ヘルスチェック

```bash
./scripts/dev-up.sh
```

- `docker compose up -d --build` を叩く
- `/health` を user-api (3100) と admin-api (8081) 両方で確認
- MySQL が `healthy` になるまで待つ
- 失敗時は `docker compose logs` を表示

### `scripts/dev-reset.sh` — 作り直し

```bash
./scripts/dev-reset.sh
```

- `docker compose down -v` でボリューム削除 → `init-db/01_schema.sql` と `02_seed_data.sql` が再実行される
- その後 `dev-up.sh` を呼ぶ

### `scripts/dev-migrate.sh` — 既存ボリュームに migration

```bash
./scripts/dev-migrate.sh                       # 全ての 0N_*_migration.sql を順番に適用
./scripts/dev-migrate.sh 08_refresh_sessions.sql # 特定ファイルだけ適用
```

- 冪等なので複数回流しても安全
- `init-db/01_schema.sql` と `02_seed_data.sql` は対象外 (新規環境専用)

### `scripts/dev-login.sh` — テストユーザー + トークン

```bash
source ./scripts/dev-login.sh
# $ACCESS_TOKEN と $REFRESH_TOKEN が shell 環境に export される
echo $ACCESS_TOKEN
```

- `.env` の `TEST_EMAIL` / `TEST_PASSWORD` を読む (未設定なら `test@example.com` / `password123` デフォルト)
- 既存ユーザーがいれば login、無ければ register
- admin トークンも欲しい場合は `source ./scripts/dev-login.sh admin` で `$ADMIN_TOKEN` に取得

## よくある詰まり

### 1. `JWT_SECRET must be at least 32 chars` で user-api が起動しない

`.env` の `JWT_SECRET` が短い。32 文字以上のランダム文字列に設定:

```bash
# 生成例
openssl rand -base64 48
```

`.env.example` の `your_jwt_secret_here_change_in_production` は 42 文字でギリギリ通るが、本番運用では必ず差し替える。

### 2. init-db/*.sql を編集したのに反映されない

**`init-db/01_schema.sql` と `02_seed_data.sql` は volume が空のときのみ実行される**。既にボリュームがあると再実行されないので、下記いずれか:

- `./scripts/dev-reset.sh` でボリュームを捨てる (手元のデータは消える)
- `init-db/0N_<feature>_migration.sql` を別途書いて `./scripts/dev-migrate.sh` で適用

詳細は `db-schema-change` Skill 参照。

### 3. admin ログイン失敗 (`ADMIN_LOGIN_FAILED`)

`.env` の `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` を確認:

```bash
curl -s -X POST http://localhost:8081/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@junc-hamburger.com","password":"admin1234"}' | jq
```

**bcrypt ハッシュ内の `$` が docker-compose で eval されてしまう罠**: `.env` の `ADMIN_PASSWORD_HASH` 内の `$` は `$$` にエスケープする (PR #55 で対応済み、`.env.example` 参照)。

### 4. Android エミュレータから localhost に繋がらない

Android エミュレータの `localhost` はエミュレータ自身を指す。ホストマシンの localhost は `10.0.2.2`:

```bash
flutter run -d emulator-5556 --dart-define=USE_MOCK=false --dart-define=API_HOST=10.0.2.2
```

iOS シミュレータ (macOS) は `localhost` のままで OK。

### 5. ポート競合 (3100 / 8081 / 3307)

`docker-compose.yml` は **許可なく変更しない**。既に 3100/8081/3307 を使っている別プロセスを止める:

```bash
lsof -i :3100
```

### 6. `/health` は OK だが API が 500 を返す

ほぼ DB 接続エラー。`docker compose logs user-api` or `admin-api` で `JWT_SECRET` 起動チェック、DB 接続エラーの有無を確認。

### 7. refresh_sessions テーブルが無い (PR #66 以降の新規 API が 500)

既存ボリュームなら `./scripts/dev-migrate.sh 08_refresh_sessions.sql` を流す。

## 最終チェックリスト (トラブル調査時)

- [ ] `docker compose ps` で 3 サービスとも Up (mysql は healthy)
- [ ] `curl -s http://localhost:3100/health` と `curl -s http://localhost:8081/health` が ok
- [ ] `.env` の `JWT_SECRET` が 32 文字以上、`ADMIN_PASSWORD_HASH` の `$` が `$$` エスケープ
- [ ] `init-db/` の最新 migration を手元 DB に流した
- [ ] (Android) `--dart-define=API_HOST=10.0.2.2`、(iOS) `localhost`
- [ ] 必要なら `docker compose logs user-api --tail=50` で起動時エラーを確認

## 禁止事項

- **`.env` をコミットしない** (`.env.example` のみ)
- **`docker-compose.yml` を許可なく変更しない**
- **`ADMIN_PASSWORD_HASH` をコマンドラインに直接貼らない** (`$` 展開の罠)
- **本番向けに `dev-reset.sh` を使わない** (ローカル専用、ボリューム破棄系)
