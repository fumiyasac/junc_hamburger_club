# OpenAPI 仕様 ↔ 実装 監査レポート

対象:
- `junc_hamburger_club_backend/user-api/swagger/openapi.yaml`
- `junc_hamburger_club_backend/admin-api/docs/swagger.yaml`

クライアント (整合性比較対象):
- Flutter: `junc_hamburger_club_mobile/lib/data/models/*.dart`
- Next.js: `junc_hamburger_club_webfront/src/lib/types.ts`

監査日: 2026-11-08  
本レポートはコード変更なし、記録のみ。

---

## 0. エンドポイント網羅性 (観点 1)

| | 仕様にあって実装にない | 実装にあって仕様にない |
|---|---|---|
| user-api | **なし** | **なし** |
| admin-api | **なし** | **なし** |

ルーティング 1 件ごとの突き合わせでは、エンドポイントの欠落はありません。

---

## 1. 不一致サマリ (重大度別)

### 🔴 高

| # | 場所 | 仕様の記述 | 実装の挙動 | 影響 | 修正案 |
|---|---|---|---|---|---|
| H-1 | `admin-api/docs/swagger.yaml:97-100` (Burger.id/categoryId) | `type: integer` | user-api は `String(id)` で文字列を返しているのに、同じ `burgers` テーブルを扱う admin-api は数値を返す。Go 側 `models.Burger.ID int` + `json:"id"` | クライアントが両 API を使い分ける際に `id` の型が混在する | **実装 or 仕様のどちらかを統一。** 推奨は仕様寄せ: admin-api も `string` を返す (Go で `json:"id,string"` or 変換メソッド) |
| H-2 | `admin-api/docs/swagger.yaml:200-213` (Order.items) | `burgerImageUrl` フィールドなし | 実装の `models.OrderItem.BurgerImageURL *string` は `json:"burgerImageUrl"` で**常に返却**している | クライアント実装者が存在しないと誤認する | **仕様を実装に合わせて追加** |
| H-3 | Flutter `data/models/*.dart` の全 `fromJson` | 仕様・両 API とも camelCase (`categoryId`, `imageUrl`, `orderNumber`, `createdAt`, …) | Flutter は **snake_case** を期待 (`category_id`, `image_url`, `order_number`, `created_at`, `profile_image_url`, `display_order`, `is_active`, `is_popular` 等) | 現状は `mock_data.dart` 経由のため顕在化していないが、**実 API に切り替えた瞬間にほぼ全画面でパース失敗** | **Flutter 側を camelCase に修正** (API/仕様は camelCase で統一されているため) |
| H-4 | `user-api/swagger/openapi.yaml:259-325` (`/auth/register`, `/auth/login` routes の validation) | バリデーションルールが暗黙に要求される (`password.minLength: 8`, `email.format` 等) | `auth.routes.ts` は `express-validator` でルール宣言のみ。`auth.controller.ts` に **`validationResult(req)` 呼び出しが無い**ためバリデーションが事実上無効 | 不正な email / 8文字未満のパスワードが通ってしまう / DB 挿入時エラーで 500 を返す | **実装側を修正**: 各 controller 冒頭で `validationResult` を確認し `400` を返す。別タスク推奨 |

### 🟠 中

| # | 場所 | 仕様の記述 | 実装の挙動 | 影響 | 修正案 |
|---|---|---|---|---|---|
| M-1 | `user-api/swagger/openapi.yaml:427-432, 519-522, 611-618, 636-645` (path params) | `id` / `itemId` / `orderId`: `type: integer` | 実装は `req.params.id` を文字列のまま SQL に渡す。`Burger.id` レスポンス自体は仕様で `string` なのに、パスでは `integer` 要求という一貫性なし | スキーマドリブンな生成ツールは id を number として生成し、クライアント実装でキャスト必要 | **仕様を `string` に統一** (user-api 全体が ID を string で扱う方針) |
| M-2 | `user-api auth.controller.ts:35-41` (register レスポンス) | `AuthResponse.data.user` は `User` schema で `profileImageUrl?: string\|null`, `createdAt: date-time` を含む | `register` 成功時は DB を再読み込みせず、`{ id, name, email, createdAt: new Date().toISOString() }` だけ返す (`profileImageUrl` なし) | 契約上 user オブジェクトに期待されるフィールドが欠落。クライアント型は optional なので実害小 | **実装側を修正**: `profileImageUrl: null` を明示付与 |
| M-3 | `admin-api/docs/swagger.yaml:236-244` (Pagination) | `{total, page, limit}` の 3 フィールドのみ | 一致。ただし user-api の Pagination は `{total, page, limit, pages}` の 4 フィールドで**内部不整合** | 同じ "ページング" を表す型が 2 系統存在 | **両 API の Pagination を揃える** (admin-api にも `pages` を追加するのが情報量的に妥当) |
| M-4 | `admin-api/handlers/auth.go:29-37` | 仕様に資格情報の格納場所の記述なし | 管理者資格情報は DB ではなく環境変数 `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` から取得 | 運用者がどこに管理者を追加すべきか迷う | **README / CLAUDE.md に記載**。仕様本体は影響なし |
| M-5 | `admin-api/docs/swagger.yaml:47-58` (AdminLoginResponse) | `data: { token, email }` | 実装も `{ token, email }`。ただし user-api `AuthResponse.data` は `{ token, user: User }` で**構造が大きく異なる** | admin / user クライアントで個別に受け側コードが必要 | **admin-api 側を `user` オブジェクト返却に揃える**か、仕様に「意図的に簡素」と注記 |
| M-6 | Flutter `Burger` model `imageUrl: String` (non-null) | 仕様・実装とも `imageUrl: nullable: true` | 実装は null を返しうる (DB 列が NULL の場合) | 実 API 接続時に `null is not String` の実行時例外 | **Flutter 側を `String?` に修正** |
| M-7 | Flutter `OrderItem` model (Burger オブジェクトを保持) | API は `{burgerId, burgerName, burgerImageUrl, quantity, unitPrice, subtotal}` のフラット構造 | Flutter は `OrderItem { id, Burger burger, quantity, unitPrice, subtotal }` で Burger 全体を要求 | 実 API 接続時に `burger` キー不在で例外 | **Flutter 側を API 形状に合わせてリファクタ** |
| M-8 | Webfront `types.ts:88-92` (AdminOrder) | admin-api の Order は `userId: integer` だが Webfront `AdminOrder.userId: number` は OK | Order を extend しているため `id: string` を継承するが admin-api は `id: integer` を返す | AdminOrder として扱うと id の型が仕様と乖離 | **H-1 の解決と連動**: ID 型を統一すれば解消 |
| M-9 | `user-api user.controller.ts:32-54` (`PUT /users/me`) | 仕様では successResponse の schema 未定義 | 実装は `{ success: true, message: 'Profile updated' }` のみで**更新後の User を返さない** | 更新後の値をクライアントが保持できず、別途 `GET /users/me` が必要 | **実装を修正**: 更新後の User を返すか、仕様で明示 |
| M-10 | `user-api order.controller.ts:164` (cancelOrder) | 仕様では `400: キャンセル不可状態` のみ | 実装は `['received']` のみキャンセル許可 (preparing 以降は不可) | 仕様に詳細条件の記載なし | **仕様に許可ステータスを明記** |
| M-11 | `admin-api/docs/swagger.yaml:338-351` (POST /burgers) | 成功時 `201` のみで body schema 無し | 実装は `{ success: true, data: { id: <int> } }` を返す | 新規作成 ID の取得方法が仕様に無い | **仕様に `data.id` を明記** |

### 🟡 低

| # | 場所 | 仕様 | 実装 | 影響 |
|---|---|---|---|---|
| L-1 | user-api `DELETE /cart`, `DELETE /cart/:itemId`, `PUT /cart/:itemId` | 200 のみ記述、body schema なし | `{ success: true, message: '...' }` を返す | 契約上の矛盾なし |
| L-2 | admin-api `PUT /burgers/:id/availability`, `PUT /users/:id/toggle` | body 無し / 200 のみ | 実装も body 不要、トグル後の新しい値は返さない | クライアントが次の値を知るには別途 GET 必要 (許容範囲) |
| L-3 | admin-api `DELETE /burgers/:id` | 200/404 のみ | 外部キー (`order_items` から参照) ありで 500 の可能性 | 仕様に 409 を追加すると丁寧 |
| L-4 | user-api `Error` schema | `{success, error}` の 2 フィールド | 一部実装では `message` フィールドを返す (cart/orders の success 時) | success 時は `Error` schema ではないので問題なし |

---

## 2. エラーレスポンス形式 (観点 3)

- **ステータスコード**: すべての controller/handler が `400 / 401 / 404 / 500` を仕様通り返す。
- **ボディ構造**: `{ success: false, error: "<msg>" }` で両 API とも統一されている。
- **特記**: 500 エラー時、user-api の `errorHandler` は本番/開発で `error` の中身を切替える。仕様には記述なし。

---

## 3. 認証要否 (観点 4)

| コンポーネント | 仕様 | 実装 | 一致 |
|---|---|---|---|
| user-api `/auth/*`, `GET /burgers*` | `security` 指定なし | `authenticate` ミドルウェア未適用 | ✅ |
| user-api `/cart/*`, `/orders/*`, `/users/*` | `security: BearerAuth` | `router.use(authenticate)` | ✅ |
| admin-api `/login` | `security` 指定なし | ミドルウェア未適用 | ✅ |
| admin-api 上記以外全て | `security: BearerAuth` | `protected.Use(middleware.AdminAuth)` | ✅ |

認証要否の記述と実装は全エンドポイントで一致しています。

---

## 4. User API / Admin API 間の表現差異 (観点 6)

同一テーブルを別 API が扱う箇所の差分:

| 項目 | user-api (仕様 & 実装) | admin-api (仕様 & 実装) | 備考 |
|---|---|---|---|
| **Burger.id / categoryId** | `string` | `integer` | 🔴 H-1 |
| **OrderItem.id / burgerId** | `string` | `integer` | H-1 と同根 |
| **User.id** | `string` | `integer` | H-1 と同根 |
| **Pagination** | `{total, page, limit, pages}` | `{total, page, limit}` | 🟠 M-3 |
| **Auth success body** | `{token, user: User}` | `{token, email}` | 🟠 M-5 |
| **order.status 列挙** | `received/preparing/ready/completed/cancelled` | 同上 | ✅ 一致 |
| **日付形式** | `format: date-time` (ISO 8601) | Go `time.Time` デフォルト (RFC3339) | ✅ 実質互換 |
| **imageUrl** | `nullable: true` | `nullable: true` | ✅ 一致 |

**最大の問題は ID 型の不統一**。他は軽微ですが、同じプロジェクト内で同じ概念に 2 つの型/構造が存在するのは契約テストや型自動生成の障害になります。

---

## 5. クライアント整合 (観点 5)

### Webfront (`src/lib/types.ts`)

- User API 仕様・実装とおおむね一致 (camelCase、id string)
- AdminOrder/AdminUser は user 型を継承しているため、admin-api 実装 (id: integer) と型レベルで乖離する余地あり (M-8)
- `Category.description` を non-nullable にしている (`string` だが仕様は `nullable: true` → types.ts では `string | null` で OK)
- `calories: number | null` も仕様と一致

→ **Webfront は仕様とほぼ一致、実装とも一致**。Admin 系の ID 型解決待ち。

### Flutter (`lib/data/models/*.dart`)

- **fromJson が snake_case を期待** — H-3 で指摘
- `Burger.imageUrl: String` が non-null — M-6 で指摘
- `OrderItem { Burger burger }` 構造違い — M-7 で指摘
- `BurgerCategory.fromJson` も `display_order`, `is_active` を期待
- `AppUser.fromJson` は `profile_image_url`, `is_active`, `created_at` を期待
- 現状はモック経由で動いているため潜在バグ。実 API 接続のタスクを行う際に必ずリファクタが必要

→ **Flutter は仕様とも実装とも乖離**。実通信前に models を全面見直し。

---

## 6. 修正方針の総まとめ

優先度順に:

1. **🔴 H-1 / H-2 / H-3 / H-4 の解消**
   - H-1/H-2: admin-api 側の仕様 & 実装を user-api 側に揃える (id: string、OrderItem に burgerImageUrl 明記)
   - H-3: Flutter models を camelCase に統一 (実 API 接続前タスクの先行着手)
   - H-4: user-api controllers で `validationResult(req)` を呼び、400 を返す
2. **🟠 中優先度 (M-1 〜 M-11)**: 仕様の軽微な加筆・実装の軽微な修正。多くは「仕様を実装に寄せる」で解消
3. **🟡 低優先度 (L-1 〜 L-4)**: 時間のある時に

---

## 7. 契約テスト・クライアント自動生成の導入提案

### 7-1. OpenAPI の HTTP 配信を揃える (前提条件)

現状、user-api は `swagger-ui-express` で `/api-docs` に **UI のみ**を配信しており、`openapi.yaml` を素で取得する URL が無い。admin-api は配信そのものを行っていない。

**Step 0**: 両 API に `/openapi.yaml` (もしくは `/openapi.json`) を静的配信するエンドポイントを追加。これが無いと Schemathesis が走れない。

### 7-2. 契約テスト: Schemathesis

**導入手順**:
1. `docker compose up -d` でバックエンドを起動
2. 新規 GitHub Actions ワークフロー `.github/workflows/contract-test.yml` を追加
3. `schemathesis run http://localhost:3100/openapi.yaml --checks all --hypothesis-max-examples 50` の形で user-api / admin-api 両方を叩く
4. 認証が必要なエンドポイントは `--auth` or `hooks` で事前にトークンを取得 (ログイン → Bearer 取得 → 他 API を叩く)
5. 失敗した場合は仕様 or 実装のドリフトとして PR に通知

**メリット**:
- 仕様書を "正" として実装の揺れを自動検出
- クエリパラメータの境界値テストも自動生成

**注意**:
- 現時点では仕様/実装のドリフトが多すぎて初回実行で大量の失敗が出る。本レポートの不整合解消後に導入するのが現実的
- 本プロジェクトの管理者ログインは環境変数認証 — CI 用に固定 ADMIN_PASSWORD_HASH を `.env.ci` で用意

### 7-3. クライアント自動生成

#### Webfront (Next.js)
- **openapi-typescript** を推奨。`package.json` の scripts に `"gen:api": "openapi-typescript swagger/openapi.yaml -o src/lib/generated/user-api.d.ts"` を追加
- 手書きの `src/lib/types.ts` を生成型に置き換え、`src/lib/api.ts` の `request<T>` に型を渡す形に
- Dependabot は OpenAPI 更新を検知しない。別途 PR フックで `gen:api` を走らせる仕組みが欲しい

#### Flutter (Mobile)
- **CLAUDE.md のルール上 `freezed` / コード生成 (`build_runner`) は禁止**
- openapi-generator (dart-dio) もコード生成ツールであり、生成物に freezed は出ないものの、プロジェクト方針との整合を協議する必要あり
- 現実的な選択肢:
  - **(a) モデルは手書きのまま。ただし camelCase 対応・null 対応を完了させ、契約テストで Flutter 側から呼び出すスモークを追加** (推奨)
  - (b) 例外として `openapi-generator-cli` のみ導入し、生成コードは `lib/generated/` に閉じ込めて MVVM 層からは触れない
  - (c) スキーマの JSON だけを assets にバンドルし、ランタイムで JSON Schema バリデートするライブラリ (`json_schema` 等) で検証する

### 7-4. 段階的ロードマップ

| 段階 | 内容 | 目安 |
|---|---|---|
| Phase 0 | 本レポートで洗い出した 🔴 高優先度不整合を別タスクで解消 | 1 PR |
| Phase 1 | 両 API に `/openapi.yaml` 配信を追加 | 小 |
| Phase 2 | Webfront に `openapi-typescript` 導入、`types.ts` を置換 | 中 |
| Phase 3 | `contract-test.yml` ワークフローで Schemathesis を回す | 中 |
| Phase 4 | Flutter models を camelCase/null-safe にリファクタし、実 API 接続 | 大 |
| Phase 5 | Flutter クライアント生成の方針決定 (手書き vs 例外的生成) | 判断待ち |

---

## 付録: 検証に使ったソース

- `junc_hamburger_club_backend/user-api/src/routes/*.ts`
- `junc_hamburger_club_backend/user-api/src/controllers/*.ts`
- `junc_hamburger_club_backend/user-api/src/middleware/auth.middleware.ts`
- `junc_hamburger_club_backend/user-api/src/app.ts`
- `junc_hamburger_club_backend/admin-api/router/router.go`
- `junc_hamburger_club_backend/admin-api/handlers/*.go`
- `junc_hamburger_club_backend/admin-api/models/models.go`
- `junc_hamburger_club_webfront/src/lib/types.ts`
- `junc_hamburger_club_webfront/src/lib/api.ts`
- `junc_hamburger_club_mobile/lib/data/models/*.dart`
