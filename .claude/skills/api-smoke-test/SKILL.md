---
name: api-smoke-test
description: User API と Admin API の主要業務フロー (登録 → ログイン → メニュー・オプション取得 → カート → pickup slot → preview → 注文 (Idempotency-Key 付き) → 管理者ステータス遷移 → refresh → logout) と代表的エラーケース (満枠・売切・不正遷移・無効トークン) を 1 本のスクリプトで通し、ステップごとに成否を出力する。「API をスモークテスト」「PR 前の疎通確認」「ログインから注文まで通し確認」「主要フローの回帰テスト」などの依頼で使用する。
---

# API スモークテスト

バックエンド (user-api + admin-api + MySQL) の主要業務フローを 1 本の bash で回す。PR の完了条件・実装直後の回帰確認・手動検証の代替として使う。

スクリプトは [`scripts/smoke.sh`](../../../scripts/smoke.sh)。

## 前提

- `local-dev-env` Skill で環境を立ち上げ済み (`./scripts/dev-up.sh` or `dev-reset.sh`)
- 既存ボリュームなら最新 migration まで適用 (`./scripts/dev-migrate.sh`)
- `.env` の `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` が初期値 (`admin1234`) のまま、または `ADMIN_PASSWORD_PLAIN` を env に export 済み
- `curl` + `jq` が利用可能

## 実行

```bash
./scripts/smoke.sh
```

出力例:

```
[✓]  1. register       — email=smoke-1795...@test.com user_id=22
[✓]  2. login          — accessToken (eyJhbGc...)
[✓]  3. me             — email=smoke-1795...@test.com
[✓]  4. burgers list   — count=20
[✓]  5. burger detail  — 1件目: JUNCクラシックバーガー, optionGroups=4
[✓]  6. add to cart    — item id=19, options=[ダブル, ベーコン]
[✓]  7. pickup slots   — 2026-11-23 available=12 件
[✓]  8. preview        — subtotal=3560 tax=356 total=3916 canPlaceOrder=true
[✓]  9. order (idem-A) — orderNumber=JUNC-20261123-0421
[✓] 10. order (idem-A) — 同じキー → 同じ注文番号 (レスポンス再生 OK)
[✓] 11. order (idem-B, diff body) → 新しい注文 (今はカート空のため CART_EMPTY) OK
[✓] 12. admin login    — ADMIN_TOKEN 取得
[✓] 13. admin get order → status=received
[✓] 14. admin transition received→preparing OK
[✓] 15. admin transition preparing→cancelled OK
[✓] 16. invalid transition cancelled→preparing → ORDER_INVALID_STATUS_TRANSITION OK
[✓] 17. refresh         — 新 accessToken が返る
[✓] 18. logout          — 旧 accessToken で /users/me → TOKEN_INVALID OK

全 18 ステップ成功
```

失敗時は該当ステップで赤字 `[✗]` を出力し、生レスポンス + exit code 1。

## 検証する項目

### 正常系 (業務フロー)
1. register / login / `/users/me`
2. バーガー一覧 + 詳細 (`optionGroups` を取得)
3. `POST /cart` with `selectedOptionIds`
4. `GET /pickup-slots?date=today`
5. `POST /orders/preview`
6. `POST /orders` with `Idempotency-Key`
7. 同じ Idempotency-Key で再送 → 同じ orderNumber
8. admin login + `PUT /admin/orders/:id/status` の遷移 received→preparing→cancelled
9. `POST /auth/refresh` でローテーション
10. `POST /auth/logout`

### エラー系
- 不正ステータス遷移 → `ORDER_INVALID_STATUS_TRANSITION` with `details.allowed`
- logout 後の accessToken 使用 → `TOKEN_INVALID` (sid 失効チェック、#66)
- (オプション) カート空で注文 → `CART_EMPTY`
- (オプション) pickup 未指定時刻 → `PICKUP_INVALID_FORMAT`

## 想定ユース

- **PR 作成前**: API を触った PR の完了条件として実行。失敗ステップがあれば修正
- **実装中の疎通確認**: 「手で curl を叩く」の代替として開発中に
- **回帰テスト**: Backend API の修正後、関連する業務フロー全体が壊れていないかの確認
- **CI (将来)**: GitHub Actions 等が入ったら nightly で回す

### CI 組み込みのメモ

現状本リポジトリは GitHub Actions 未設置。将来 CI を入れる場合は:

```yaml
# .github/workflows/smoke.yml (将来)
on: { schedule: [{ cron: '0 18 * * *' }] }   # 03:00 JST nightly
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup env
        run: |
          cp junc_hamburger_club_backend/.env.example junc_hamburger_club_backend/.env
          # JWT_SECRET を 32+ 文字で上書き
          echo "JWT_SECRET=$(openssl rand -base64 48)" >> junc_hamburger_club_backend/.env
      - run: ./scripts/dev-up.sh
      - run: ./scripts/smoke.sh
```

**別タスクで対応**: 現状スコープ外。

## カスタマイズ

- 環境変数で挙動を変更可:
  - `USER_API_URL` (default `http://localhost:3100/api/v1`)
  - `ADMIN_API_URL` (default `http://localhost:8081/api/v1/admin`)
  - `ADMIN_EMAIL` / `ADMIN_PASSWORD_PLAIN` (`.env` から読まれる)

- 新機能を追加した時は `scripts/smoke.sh` に対応するステップを追加 (CSV の行を増やすイメージで 1 ブロック追記)

## 禁止事項

- **本番環境に向けて実行しない** (ユーザー登録が本物に記録されるため、localhost 限定)
- **スクリプト内に secrets をハードコードしない** (全て `.env` 経由)
- **`smoke.sh` の代わりに手 curl だけで済ませない** (特に Idempotency-Key・ステータス遷移は手動で見落としやすい)
