---
name: api-endpoint-change
description: User API (TypeScript/Express) または Admin API (Go/Gin) にエンドポイントを追加・変更するとき、OpenAPI 仕様 ↔ 実装 ↔ TS/Dart クライアントの 4 層を正しい順序で同期させる。「API を追加」「新しいエンドポイント」「ルートを増やす」「Swagger を更新」「API のレスポンスを変える」などの依頼で使用する。
---

# API エンドポイント追加・変更の手順

このリポジトリは **user-api (TS/Express) と admin-api (Go/Gin) の 2 つの API が同じ MySQL を共有** している。新規エンドポイントや変更のたびに最低 3〜4 層を触るため、順序を間違えると契約がドリフトする。本 Skill は確定している「正しい順序」を強制する。

前提知識は [`CLAUDE.md`](../../../CLAUDE.md) と [`junc_hamburger_club_backend/CLAUDE.md`](../../../junc_hamburger_club_backend/CLAUDE.md) を参照。

## まず判断する

### A. どちらの API か

| 用途 | API | パス接頭辞 | 認証 |
|---|---|---|---|
| モバイル or 公開 Web から使う | **user-api** | `/api/v1/<topic>` | JWT (`authenticate` middleware) または不要 |
| Web 管理画面からのみ使う | **admin-api** | `/api/v1/admin/<topic>` | JWT (`middleware.AdminAuth`) 必須 |

**両方から呼ぶべき処理は user-api 側に実装し、admin-api からは呼ばない** (重複実装は禁止)。

### B. 新規 topic か、既存 topic に追加か

- 新規 topic (例: "reviews") → 新規ファイルセットを作る
- 既存 topic に 1 本追加 → 既存 route/handler に追記のみ

## 共通規約 (両 API)

| 項目 | ルール |
|---|---|
| レスポンス形式 (成功) | `{ "success": true, "data": <...> }` |
| レスポンス形式 (エラー) | `{ "success": false, "error": "<message>" }` |
| ID 型 | **JSON 上は常に string**。user-api は `String(row.id)`、admin-api は `json:"id,string"` タグ |
| ページング | `{ total, page, limit, pages }` を data に含める |
| 日本語データ | DB は utf8mb4。SQL ファイルには `SET NAMES utf8mb4;` が必須 ([`backend/CLAUDE.md`](../../../junc_hamburger_club_backend/CLAUDE.md) 参照) |
| path params | OpenAPI では `type: string` |
| バリデーションエラー | **400 を返す** (後述) |

## 作業順序 (全エンドポイント共通)

### 1. OpenAPI 仕様を先に書く

user-api: [`junc_hamburger_club_backend/user-api/swagger/openapi.yaml`](../../../junc_hamburger_club_backend/user-api/swagger/openapi.yaml)
admin-api: [`junc_hamburger_club_backend/admin-api/docs/swagger.yaml`](../../../junc_hamburger_club_backend/admin-api/docs/swagger.yaml)

- `components.schemas` に DTO を追加
- `paths` にエンドポイントを追加
- `security: [BearerAuth: []]` を忘れない (user-api の `/cart`, `/orders`, `/users`, admin-api の `/login` 以外ほぼ全て)
- レスポンス 200/201 以外に **400 (バリデーション) / 401 (認証) / 404 / 409 (競合)** を明示する

### 2. 実装 (user-api の場合)

[`templates/user-api-route.ts`](templates/user-api-route.ts) と [`templates/user-api-controller.ts`](templates/user-api-controller.ts) を参照して作成。

1. `src/types/index.ts` に対応する `<Entity>Row` 型を追加 (DB 行、snake_case)
2. `src/controllers/<topic>.controller.ts` に `format<Entity>()` と各ハンドラを追加
3. `src/routes/<topic>.routes.ts` を新規 or 既存に追記
   - 認証が必要なら先頭で `router.use(authenticate)` (`../middleware/auth.middleware`)
   - バリデーションは `body(...)` 定義 + `validate` middleware ([`src/middleware/validate.middleware.ts`](../../../junc_hamburger_club_backend/user-api/src/middleware/validate.middleware.ts) を挟む) → 失敗時 400
4. **新規 topic の場合のみ** `src/app.ts` に `app.use('/api/v1/<topic>', <topic>Routes)` を追加
5. SQL 発行は `pool.query<RowDataPacket[]>(sql, params)` 固定。`?` プレースホルダ厳守
6. 返却直前に `formatEntity()` を通して DB 列 (snake_case) → JSON (camelCase) + 型変換

### 3. 実装 (admin-api の場合)

[`templates/admin-api-handler.go`](templates/admin-api-handler.go) を参照。

1. `models/models.go` に struct を追加。**`int` 型 ID は `json:"<name>,string"` タグ必須** (user-api との契約統一)
2. `handlers/<topic>.go` を新規 or 既存に追記
   - `type <Topic>Handler struct { DB *sql.DB }` 形式
   - リクエスト DTO も `json:"categoryId,string"` でクライアントから string を受ける
3. `router/router.go` の `protected` グループ (JWT 必須) に `protected.GET("/<topic>", h.List<Topic>)` 等を追加。認証不要にしたい場合はごく稀 (login 等) で、`api.POST` 直下に書く
4. エラー時は `c.JSON(http.StatusXxx, gin.H{"success": false, "error": "..."})`
5. FK 制約違反 (エラーコード 1451) を検知したら 409 を返す (`strings.Contains(err.Error(), "1451")` パターン)
6. ID を含むレスポンスで手動 `gin.H` を使うときは `strconv.Itoa(id)` で文字列化

### 4. クライアント同期

#### webfront ([`src/lib/api.ts`](../../../junc_hamburger_club_webfront/src/lib/api.ts) + [`types.ts`](../../../junc_hamburger_club_webfront/src/lib/types.ts))

```ts
// types.ts に型を追加 (ID は必ず string)
export interface MyEntity {
  id: string
  name: string
  // ...
}

// api.ts に追加。認証付きは authHeader(token) を渡す
export const adminMyEntityApi = {
  list: (token: string) =>
    request<{ items: MyEntity[]; pagination: PaginationMeta }>(
      `${ADMIN_API}/my-entities`,
      { headers: authHeader(token) },
    ),
}
```

#### Flutter (`junc_hamburger_club_mobile/lib/data/`)

モデルは `data/models/<entity>.dart` に手書き。**`freezed` / `@riverpod` / `build_runner` は使わない** (CLAUDE.md 禁止事項)。Repository は `data/repositories/` にインターフェース + Impl。現状は全モック実装。実 API 配線は Impl 側差し替えで完結させる。

詳しくは `flutter-feature` Skill を参照。

### 5. 動作確認

```bash
# バックエンド起動
cd junc_hamburger_club_backend && docker compose up -d --build
docker compose logs -f user-api   # or admin-api

# user-api 疎通
curl -s http://localhost:3100/api/v1/<topic> | jq

# 認証付きなら:
TOKEN=$(curl -s -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r .data.token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/v1/<topic> | jq

# OpenAPI 表示確認
open http://localhost:3100/api-docs
```

バリデーションの動作確認も必ず行う (無効値で 400 が返るか、必須フィールド欠如時のメッセージ等)。

## 最終チェックリスト

実装完了前に全項目を確認:

- [ ] OpenAPI spec を**先に**書いた (後付けでドリフトしない)
- [ ] レスポンス形式が `{ success, data }` / `{ success: false, error }` になっている
- [ ] ID フィールドが JSON 上で string (user-api の `String(id)`, admin-api の `json:",string"`)
- [ ] path params の OpenAPI 型は `string`
- [ ] 認証が必要なエンドポイントは適切な middleware 下に配置した
- [ ] 400 / 401 / 404 / 409 が必要な箇所で正しく返る
- [ ] バリデーションルール (express-validator or Gin binding) が仕様と一致
- [ ] 日本語データが文字化けしない (utf8mb4 設定、`SET NAMES utf8mb4` on seed)
- [ ] webfront `types.ts` + `api.ts` を同期した (admin API を使うなら)
- [ ] Flutter `data/models` + `data/repositories` を同期した (user API を使うなら)
- [ ] curl で成功系・エラー系の両方を確認した
- [ ] Swagger UI (http://localhost:3100/api-docs) で正しく見える

## 禁止事項

- **`docker-compose.yml` を許可なく変更しない** (ポート競合は競合側の停止で解決)
- **稼働中コンテナに直接 ALTER TABLE を打たない** (スキーマ変更時は `db-schema-change` Skill を使用し、`docker compose down -v` で作り直す)
- **ID を number で返さない** (両 API で string 統一)
- **validation を routes に書いて controller で `validationResult(req)` を呼ばない実装にしない** (= `validate` middleware を必ず噛ます)
