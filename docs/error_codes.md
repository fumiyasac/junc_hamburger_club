# JUNC Hamburger Club — エラーコード一覧

> User API (TypeScript/Express) と Admin API (Go/Gin) の全エラーレスポンスは以下の形式に統一されている。クライアント (Flutter / webfront) は `error.code` で機械判別し、`error.message` を UI にそのまま表示できる。

## 統一フォーマット

```json
{
  "success": false,
  "error": {
    "code": "PICKUP_SLOT_FULL",
    "message": "この時間帯は予約がいっぱいです",
    "details": { "slotAt": "2026-11-21T11:00:00+09:00" }
  }
}
```

- **code**: `UPPER_SNAKE_CASE`。全層で一意
- **message**: 日本語。UI にそのまま出せる自然文
- **details**: UI 分岐に必要な構造化データ。無い場合はキー自体を省略しても `{}` でもよい (クライアントは両方許容)

## HTTP ステータスとコード対応表

### 共通系

| HTTP | code | message | details | 発生箇所 |
|---|---|---|---|---|
| 400 | `VALIDATION_FAILED` | 入力値が不正です | `[{field, message}]` | express-validator / Go バリデーション |
| 404 | `RESOURCE_NOT_FOUND` | リソースが見つかりません | `{resourceType, resourceId}` | 汎用 404 |
| 500 | `INTERNAL_ERROR` | サーバー内部エラーが発生しました | — | 未捕捉例外 |

### 認証・認可

| HTTP | code | message |
|---|---|---|
| 401 | `AUTH_TOKEN_MISSING` | 認証情報が見つかりません |
| 401 | `AUTH_TOKEN_EXPIRED` | トークンの有効期限が切れています |
| 401 | `AUTH_TOKEN_INVALID` | 認証トークンが不正です |
| 401 | `AUTH_USER_INACTIVE` | アカウントが無効化されています |
| 401 | `ADMIN_LOGIN_FAILED` | メールアドレスまたはパスワードが違います |
| 403 | `AUTH_FORBIDDEN` | この操作を実行する権限がありません |

### ユーザー登録・ログイン

| HTTP | code | message |
|---|---|---|
| 400 | `USER_EMAIL_IN_USE` | このメールアドレスは既に登録されています |
| 401 | `USER_LOGIN_FAILED` | メールアドレスまたはパスワードが違います |
| 400 | `USER_PASSWORD_CURRENT_INVALID` | 現在のパスワードが違います |

### カート

| HTTP | code | message |
|---|---|---|
| 400 | `CART_EMPTY` | カートが空です |
| 404 | `CART_ITEM_NOT_FOUND` | カートアイテムが見つかりません |
| 400 | `CART_ITEM_OPTIONS_IMMUTABLE` | オプションは変更できません。削除して追加しなおしてください |

### バーガー

| HTTP | code | message |
|---|---|---|
| 404 | `BURGER_NOT_FOUND` | 指定のバーガーが見つかりません |
| 400 | `BURGER_UNAVAILABLE` | このバーガーは現在販売されていません |

### 受け取り枠

| HTTP | code | details | message |
|---|---|---|---|
| 400 | `PICKUP_INVALID_FORMAT` | — | 受け取り時刻の形式が不正です |
| 400 | `PICKUP_BOUNDARY` | `{slotIntervalMin}` | 受け取り時刻は枠の区切り時刻に合わせてください |
| 400 | `PICKUP_CLOSED_DAY` | — | 指定日は定休日です |
| 400 | `PICKUP_PAST_LOOKAHEAD` | — | 予約受付期間外です |
| 400 | `PICKUP_OUT_OF_HOURS` | `{openTime, closeTime}` | 営業時間外です |
| 400 | `PICKUP_LEAD_TIME` | `{leadTimeMin}` | 受け取り時刻が早すぎます |
| 409 | `PICKUP_SLOT_FULL` | `{slotAt}` | この時間帯は予約がいっぱいです |

### オプション

| HTTP | code | details | message |
|---|---|---|---|
| 400 | `OPTION_NOT_FOUND` | `{optionIds}` | 指定のオプションが見つかりません |
| 400 | `OPTION_INVALID_BURGER` | `{optionId, groupId}` | このバーガーでは選択できないオプションです |
| 400 | `OPTION_GROUP_REQUIRED` | `{groupId, groupName}` | 必須の選択項目があります |
| 400 | `OPTION_GROUP_MIN_VIOLATION` | `{groupId, groupName, minSelect, selected}` | 選択数が不足しています |
| 400 | `OPTION_GROUP_MAX_VIOLATION` | `{groupId, groupName, maxSelect, selected}` | 選択数が上限を超えています |
| 400 | `OPTION_OUT_OF_STOCK` | `{optionId, optionName}` | 選択したオプションは売り切れです |
| 400 | `OPTION_OUT_OF_STOCK_AT_ORDER` | `{itemId, optionId, optionName}` | カート内オプションが売り切れになりました |

### 注文

| HTTP | code | details | message |
|---|---|---|---|
| 404 | `ORDER_NOT_FOUND` | — | 注文が見つかりません |
| 409 | `ORDER_INVALID_STATUS_TRANSITION` | `{current, requested, allowed}` | この状態からは指定のステータスに遷移できません |
| 409 | `ORDER_CANCEL_NOT_ALLOWED` | `{currentStatus}` | 現在のステータスではキャンセルできません |
| 409 | `ORDER_IDEMPOTENCY_IN_PROGRESS` | `{idempotencyKey}` | 同じキーで処理が実行中です。少し待って再試行してください |
| 422 | `ORDER_IDEMPOTENCY_CONFLICT` | `{idempotencyKey}` | 同じキーで異なる内容のリクエストが既に送信されています |

### Admin

| HTTP | code | details | message |
|---|---|---|---|
| 409 | `BURGER_REFERENCED_BY_ORDERS` | — | 注文履歴があるため削除できません。販売停止にしてください |
| 400 | `OPTION_GROUP_VALIDATION` | — | オプショングループの設定が不正です |
| 400 | `OPTION_GROUP_INVALID_ID` | `{value}` | groupId の指定が不正です |

### アプリ設定

| HTTP | code | message |
|---|---|---|
| 500 | `APP_CONFIG_NOT_FOUND` | アプリ設定が初期化されていません |
| 500 | `STORE_PROFILE_MISSING` | 店舗プロフィールが設定されていません |

## 命名規則

- `UPPER_SNAKE_CASE`
- プレフィクスでドメインを示す (`AUTH_` / `CART_` / `OPTION_` / `PICKUP_` / `ORDER_` / `BURGER_` / `ADMIN_` / `USER_`)
- 汎用は無プレフィクス (`VALIDATION_FAILED`, `RESOURCE_NOT_FOUND`, `INTERNAL_ERROR`)
- 過去形で状態を表す (`_FAILED`, `_IN_PROGRESS`, `_NOT_FOUND`, `_INVALID`)

## 注文ステータス遷移表

```
received  → preparing, cancelled
preparing → ready, cancelled
ready     → completed
completed → (終端)
cancelled → (終端)
```

- `ready` / `completed` / `cancelled` からの遷移はすべて不正 → `ORDER_INVALID_STATUS_TRANSITION`
- user-api の `PUT /orders/:id/cancel` は `received` のみ許可 (ユーザー起点のキャンセル)
- admin-api の `PUT /admin/orders/:id/status` は上の表全体を許可

## Idempotency

`POST /api/v1/orders` は `Idempotency-Key` ヘッダ (任意) を受け付ける。詳細は [`options_rules.md`](options_rules.md) の後継としての本仕様で管理。

- 同じユーザー・同じキーで成功済み → 保存されたレスポンスを再生
- 処理中 (`PENDING`) に再送 → `ORDER_IDEMPOTENCY_IN_PROGRESS`
- 同じキーで異なる body → `ORDER_IDEMPOTENCY_CONFLICT`
- **失敗時の挙動**: サーバー側エラー (DB / 内部例外) または業務エラー (`CART_EMPTY` / `PICKUP_SLOT_FULL` / `OPTION_OUT_OF_STOCK_AT_ORDER` 等) が返ると、`idempotency_keys` の PENDING 行は削除される。同じキーで再送すれば新規扱いで再試行できる (失敗レスポンスは再生されない方針)
- 保持期間: 24 時間 (SUCCEEDED 行のみ)。PENDING が長時間残るケースは本来起きない
