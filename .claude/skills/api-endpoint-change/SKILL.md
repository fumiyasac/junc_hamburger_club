---
name: api-endpoint-change
description: User API (TypeScript/Express) または Admin API (Go/Gin) にエンドポイントを追加・変更するとき、OpenAPI 仕様 ↔ 実装 ↔ TS/Dart クライアントの 4 層と、#65 で入った統一エラー形式 (error.code/message/details) ・#66 の認証エラーコード (TOKEN_*/USER_DEACTIVATED) を正しい順序で同期させる。「API を追加」「新しいエンドポイント」「ルートを増やす」「Swagger を更新」「API のレスポンスを変える」などの依頼で使用する。
---

# API エンドポイント追加・変更の手順

このリポジトリは **user-api (TS/Express) と admin-api (Go/Gin) の 2 つの API が同じ MySQL を共有** している。新規エンドポイントや変更のたびに最低 3〜4 層を触るため、順序を間違えると契約がドリフトする。本 Skill は確定している「正しい順序」を強制する。

前提知識: [`CLAUDE.md`](../../../CLAUDE.md), [`junc_hamburger_club_backend/CLAUDE.md`](../../../junc_hamburger_club_backend/CLAUDE.md), [`docs/error_codes.md`](../../../docs/error_codes.md)

## まず判断する

### A. どちらの API か

| 用途 | API | パス接頭辞 | 認証 |
|---|---|---|---|
| モバイル or 公開 Web から使う | **user-api** | `/api/v1/<topic>` | JWT (`authenticate` middleware) または不要 |
| Web 管理画面からのみ使う | **admin-api** | `/api/v1/admin/<topic>` | JWT (`middleware.AdminAuth`) 必須 |

**両方から呼ぶべき処理は user-api 側に実装し、admin-api からは呼ばない**。

### B. 新規 topic か既存 topic 追記か

- 新規 topic (例: "reviews") → 新規ファイルセットを作る
- 既存 topic に 1 本追記 → 既存 route/handler に追記のみ

### C. Idempotency-Key を受けるべきか (書き込み系のみ判断する)

**該当エンドポイント** (POST / PUT / DELETE 相当) に対し、以下を全て満たすなら受ける:

1. 副作用がある (DB 書き込み・外部通知・課金)
2. 同一リクエストの再送で「結果が 1 回しか起きない」ことがクライアントに要求される
3. 客先 (Flutter / webfront) が再試行する可能性がある

**例**:
- `POST /orders` → 必須 (重複注文を絶対に避ける)
- `POST /cart` → 不要 (数量加算が業務的に自然)
- `POST /auth/refresh` → 不要 (ローテーション自体が冪等性担保)
- `PUT /users/me` → 不要 (idempotent なプロフィール更新)

必要な場合は user-api `src/middleware/idempotency.middleware.ts` を参考に `wrapAsync(idempotency), wrapAsync(handler)` の順で挟む。失敗時は PENDING 行が middleware で削除され、同キーで再試行可能。

## 共通規約 (両 API)

| 項目 | ルール |
|---|---|
| レスポンス形式 (成功) | `{ "success": true, "data": <...> }` |
| レスポンス形式 (エラー) | `{ "success": false, "error": { "code": "UPPER_SNAKE_CASE", "message": "日本語", "details": {...}? } }` |
| エラーコード一覧 | **必ず [`docs/error_codes.md`](../../../docs/error_codes.md) を正本**とし、追加時は同ファイルに 1 行追記 |
| ID 型 | JSON 上は常に string。user-api は `String(row.id)`、admin-api は `json:"id,string"` |
| ページング | `{ total, page, limit, pages }` を data に含める |
| 日本語データ | DB は utf8mb4。SQL ファイルには `SET NAMES utf8mb4;` が必須 |
| path params | OpenAPI では `type: string` |

## エラーコード命名規則

- `UPPER_SNAKE_CASE` のみ。アンダースコア区切り、プレフィクスなしの汎用 (`VALIDATION_FAILED` / `INTERNAL_ERROR` / `RESOURCE_NOT_FOUND`) を除いては**ドメインプレフィクス**を付ける
- 既存プレフィクス: `TOKEN_` `USER_` `BURGER_` `CART_` `PICKUP_` `OPTION_` `ORDER_` `ADMIN_` `APP_` `STORE_`
- 新規追加は以下の 4 箇所を**同時に**更新:
  1. [`docs/error_codes.md`](../../../docs/error_codes.md) の該当ドメインセクションに 1 行追加 (HTTP / code / message / details / Flutter 側の推奨対応)
  2. user-api [`src/lib/errors.ts`](../../../junc_hamburger_club_backend/user-api/src/lib/errors.ts) の `ErrorCode` union に追加 (使う側なら)
  3. admin-api [`errors/errors.go`](../../../junc_hamburger_club_backend/admin-api/errors/errors.go) にプリセット関数追加 (使う側なら)
  4. 両 OpenAPI の該当エンドポイントの `description` に enum 相当で列挙

## 作業順序 (全エンドポイント共通)

### 1. OpenAPI 仕様を先に書く

user-api: [`junc_hamburger_club_backend/user-api/swagger/openapi.yaml`](../../../junc_hamburger_club_backend/user-api/swagger/openapi.yaml)
admin-api: [`junc_hamburger_club_backend/admin-api/docs/swagger.yaml`](../../../junc_hamburger_club_backend/admin-api/docs/swagger.yaml)

- `components.schemas` に DTO を追加
- **エラーレスポンスは `{ $ref: '#/components/schemas/Error' }` を使う**。インラインで書かない (既に両 API の components に `Error` + `ErrorBody` schema が定義済み)
- 返しうる `error.code` は `description` に箇条書きで明記 (enum 相当):
  ```yaml
  '400':
    description: |
      - `VALIDATION_FAILED` — 入力値エラー (details.issues)
      - `OPTION_OUT_OF_STOCK` (details.{optionId, optionName})
    content:
      application/json:
        schema: { $ref: '#/components/schemas/Error' }
  ```
- `security: [BearerAuth: []]` を忘れない (user-api の `/cart`, `/orders`, `/users`, admin-api の `/login` 以外ほぼ全て)
- 必要なレスポンス: `200/201` + `400 (VALIDATION_FAILED)` / `401 (TOKEN_*)` / `404 (RESOURCE_NOT_FOUND)` / `409 (競合)` を明示

### 2. 実装 (user-api の場合)

[`templates/user-api-route.ts`](templates/user-api-route.ts) と [`templates/user-api-controller.ts`](templates/user-api-controller.ts) を参照。

1. `src/types/index.ts` に `<Entity>Row` 型を追加 (DB 行、snake_case)
2. `src/controllers/<topic>.controller.ts` に `format<Entity>()` と各ハンドラを追加
   - **エラーは `throw new AppError(code, message, httpStatus, details?)` または `Errors.*()`**。`res.status().json()` で直接返さない
   - 未捕捉例外は `src/middleware/error.middleware.ts` が `INTERNAL_ERROR` 500 に変換する
3. `src/routes/<topic>.routes.ts` を新規 or 既存に追記
   - **全ハンドラを `wrapAsync()` で包む** (Express 4 は async エラーを自動 forward しない)
   - 認証が必要なら先頭で `router.use(authenticate)`
   - バリデーションは `body(...)` 定義 + `validate` middleware (失敗で `VALIDATION_FAILED` + `details.issues`)
   - 認証系で高頻度 (login/register/refresh) なら rate limit middleware を併用
4. **新規 topic の場合のみ** `src/app.ts` に `app.use('/api/v1/<topic>', <topic>Routes)` を追加
5. SQL は `pool.query<RowDataPacket[]>(sql, params)` 固定、`?` プレースホルダ厳守
6. 返却直前に `formatEntity()` で DB 列 (snake_case) → JSON (camelCase) + 型変換

### 3. 実装 (admin-api の場合)

[`templates/admin-api-handler.go`](templates/admin-api-handler.go) を参照。

1. `models/models.go` に struct を追加。`int` 型 ID は `json:"<name>,string"` タグ必須
2. `handlers/<topic>.go` を新規 or 既存に追記
   - **エラーは `apierr.*(c, ...)` プリセット関数 or `apierr.RespondCode(c, code, message, httpStatus, details)`**。`c.JSON(http.Status*, gin.H{"success":false, "error":"..."})` の旧形式は使わない
   - 認証エラーは middleware が処理するので handler 側では意識しない (ただし Validation / Internal / NotFound / 独自 domain エラーは handler で返す)
3. `router/router.go` の `protected` グループ (JWT 必須) に `protected.GET("/<topic>", h.List<Topic>)` 等を追加
4. FK 制約違反 (エラーコード 1451) を検知したら `apierr.BurgerReferencedByOrders(c)` 相当のプリセットを呼ぶ

### 4. クライアント同期

#### webfront ([`src/lib/api.ts`](../../../junc_hamburger_club_webfront/src/lib/api.ts) + [`types.ts`](../../../junc_hamburger_club_webfront/src/lib/types.ts))

```ts
// types.ts に型を追加 (ID は必ず string)
export interface MyEntity { id: string; name: string }

// api.ts に追加。認証付きは authHeader(token) を渡す
export const adminMyEntityApi = {
  list: (token: string) =>
    request<{ items: MyEntity[]; pagination: PaginationMeta }>(
      `${ADMIN_API}/my-entities`,
      { headers: authHeader(token) },
    ),
}
```

webfront の `request<T>` は失敗時に `ApiError { code, message, details, httpStatus }` を throw する (旧 `Error(json.error)` 文字列は廃止)。呼び出し側は `err instanceof ApiError` + `err.code` で分岐可能。

#### Flutter

Flutter は実 API 接続フェーズで Mock/Api 2 実装を併設する方針。**`flutter-feature` Skill** と **`flutter-api-integration` Skill** を参照。

### 5. 動作確認

`local-dev-env` Skill のスクリプトで環境を立てた後:

```bash
# 疎通
curl -s http://localhost:3100/api/v1/<topic> | jq

# 認証付き (register → accessToken 取得)
TOKEN=$(curl -s -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r .data.accessToken)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/v1/<topic> | jq

# OpenAPI 表示確認
open http://localhost:3100/api-docs
```

**エラーパスの curl 確認を必ず行う**: 無効入力で `error.code: "VALIDATION_FAILED"` が返るか、認証無しで `TOKEN_MISSING` が返るか、など。

通し検証は `api-smoke-test` Skill の `scripts/smoke.sh` で自動化できる。

## 最終チェックリスト

- [ ] OpenAPI spec を**先に**書いた
- [ ] 成功レスポンス `{ success, data }`、エラーは `{ success: false, error: { code, message, details? } }`
- [ ] 新規エラーコードを `docs/error_codes.md` に追記した
- [ ] エラーコード命名が UPPER_SNAKE_CASE + ドメインプレフィクス
- [ ] OpenAPI のエラーレスポンスは `$ref: '#/components/schemas/Error'` を使い、`description` に code を列挙した
- [ ] user-api は `AppError` throw + `wrapAsync` で route 包み
- [ ] admin-api は `apierr.*` プリセット使用
- [ ] 書き込み系で Idempotency-Key が必要かを判定し、必要なら middleware を追加した
- [ ] ID フィールドが JSON 上で string
- [ ] webfront `types.ts` + `api.ts` を同期した
- [ ] Flutter の Api 実装を同期した (`flutter-api-integration` 参照)
- [ ] curl で成功系・エラー系の両方を確認した
- [ ] Swagger UI (http://localhost:3100/api-docs) で正しく見える

## 禁止事項

- **`docker-compose.yml` を許可なく変更しない**
- **稼働中コンテナに直接 ALTER TABLE を打たない** (スキーマは `db-schema-change` Skill)
- **ID を number で返さない**
- **エラーを `res.status().json({success:false, error:"文字列"})` で返さない** (#65 で破壊的に廃止)
- **validation を routes に書いて controller で `validationResult(req)` を呼ばない実装** (必ず `validate` middleware を噛ます)
- **既存の `AUTH_TOKEN_*` / `AUTH_USER_INACTIVE` を使わない** (#66 で `TOKEN_*` / `USER_DEACTIVATED` に rename 済み)
