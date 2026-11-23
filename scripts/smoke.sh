#!/usr/bin/env bash
# API スモークテスト: user-api + admin-api の主要業務フローと代表エラーを通し検証。
#
# 使い方:
#   ./scripts/smoke.sh
#
# 前提: ./scripts/dev-up.sh でバックエンド起動済み、jq インストール済み。

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/junc_hamburger_club_backend"
USER_API="${USER_API_URL:-http://localhost:3100/api/v1}"
ADMIN_API="${ADMIN_API_URL:-http://localhost:8081/api/v1/admin}"

# .env は source すると引用符無しのスペース混じり値 (STORE_NAME 等) で破綻する。
# 必要な特定キーだけを安全に抽出。
_read_env() {
  local key="$1"
  [[ -f "$BACKEND_DIR/.env" ]] || return 0
  grep -E "^${key}=" "$BACKEND_DIR/.env" | tail -1 | sed "s/^${key}=//"
}
ADMIN_EMAIL="${ADMIN_EMAIL:-$(_read_env ADMIN_EMAIL)}"
: "${ADMIN_EMAIL:=admin@junc-hamburger.com}"
: "${ADMIN_PASSWORD_PLAIN:=admin1234}"

STEP=0
FAILED=0
LAST_RES=""

_step_ok()   { printf "[\033[32m✓\033[0m] %2d. %-18s — %s\n" "$1" "$2" "$3"; }
_step_fail() { printf "[\033[31m✗\033[0m] %2d. %-18s — %s\n" "$1" "$2" "$3"; echo "   response: $LAST_RES"; FAILED=$((FAILED+1)); }

# assert_ok  <name> <condition-expr>  (eval 評価)
assert_ok()   { STEP=$((STEP+1)); if eval "$2"; then _step_ok "$STEP" "$1" "$3"; else _step_fail "$STEP" "$1" "$3"; fi; }

EMAIL="smoke-$(date +%s)-$$@test.com"
PASSWORD="password123"

# ─── 1. register ──────────────────────────────────────────────
LAST_RES=$(curl -s -X POST "$USER_API/auth/register" -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
OK=$(echo "$LAST_RES" | jq -r '.success')
USER_ID=$(echo "$LAST_RES" | jq -r '.data.user.id // empty')
AT=$(echo "$LAST_RES" | jq -r '.data.accessToken // empty')
RT=$(echo "$LAST_RES" | jq -r '.data.refreshToken // empty')
assert_ok "register" '[[ "$OK" == "true" && -n "$AT" && -n "$RT" ]]' "user_id=$USER_ID"

# ─── 2. login (別 session を取得して後で使う) ───────────────
LAST_RES=$(curl -s -X POST "$USER_API/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
OK=$(echo "$LAST_RES" | jq -r '.success')
AT_LOGIN=$(echo "$LAST_RES" | jq -r '.data.accessToken // empty')
assert_ok "login" '[[ "$OK" == "true" && -n "$AT_LOGIN" ]]' "accessToken (${AT_LOGIN:0:12}...)"

# ─── 3. /users/me ─────────────────────────────────────────────
LAST_RES=$(curl -s -H "Authorization: Bearer $AT" "$USER_API/users/me")
ME_EMAIL=$(echo "$LAST_RES" | jq -r '.data.email // empty')
assert_ok "me" '[[ "$ME_EMAIL" == "$EMAIL" ]]' "email=$ME_EMAIL"

# ─── 4. burgers list ─────────────────────────────────────────
LAST_RES=$(curl -s "$USER_API/burgers")
BCOUNT=$(echo "$LAST_RES" | jq -r '.data.burgers | length // 0')
assert_ok "burgers list" '[[ "$BCOUNT" -gt 0 ]]' "count=$BCOUNT"

# ─── 5. burger detail ────────────────────────────────────────
BID=$(echo "$LAST_RES" | jq -r '.data.burgers[0].id')
LAST_RES=$(curl -s "$USER_API/burgers/$BID")
BNAME=$(echo "$LAST_RES" | jq -r '.data.name')
OG_COUNT=$(echo "$LAST_RES" | jq -r '.data.optionGroups // [] | length')
assert_ok "burger detail" '[[ -n "$BNAME" && "$OG_COUNT" -ge 0 ]]' "$BNAME (optionGroups=$OG_COUNT)"

# ─── 6. add to cart ──────────────────────────────────────────
# 各必須グループから 1 個だけ (max を超えない、在庫あり)
JSON_OPT_IDS=$(echo "$LAST_RES" | jq -c '
  [ (.data.optionGroups // [])[]
    | select(.isRequired == true)
    | (.options | map(select(.isAvailable == true)) | first).id
    | select(. != null) ]')
LAST_RES=$(curl -s -X POST "$USER_API/cart" -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"burgerId\":\"$BID\",\"quantity\":1,\"selectedOptionIds\":$JSON_OPT_IDS}")
OK=$(echo "$LAST_RES" | jq -r '.success')
UNIT=$(echo "$LAST_RES" | jq -r '.data.unitPrice // empty')
assert_ok "add to cart" '[[ "$OK" == "true" && -n "$UNIT" ]]' "unitPrice=$UNIT"

# ─── 7. pickup slots ─────────────────────────────────────────
TODAY=$(date +%Y-%m-%d)
LAST_RES=$(curl -s "$USER_API/pickup-slots?date=$TODAY" -H "Authorization: Bearer $AT")
SLOT=$(echo "$LAST_RES" | jq -r '.data.slots[]? | select(.available == true) | .startAt' | head -1)
SCOUNT=$(echo "$LAST_RES" | jq -r '[.data.slots[]? | select(.available == true)] | length')
assert_ok "pickup slots" '[[ -n "$SLOT" ]]' "available=$SCOUNT (first=$SLOT)"

# ─── 8. preview ─────────────────────────────────────────────
LAST_RES=$(curl -s -X POST "$USER_API/orders/preview" -H "Authorization: Bearer $AT" -H "Content-Type: application/json" \
  -d "{\"pickupAt\":\"$SLOT\"}")
CAN=$(echo "$LAST_RES" | jq -r '.data.canPlaceOrder // empty')
TOTAL=$(echo "$LAST_RES" | jq -r '.data.total // empty')
assert_ok "preview" '[[ "$CAN" == "true" && -n "$TOTAL" ]]' "total=$TOTAL canPlaceOrder=$CAN"

# ─── 9. order with Idempotency-Key ────────────────────────────
IDEM_KEY="smoke-$(date +%s)-$$-order1"
LAST_RES=$(curl -s -X POST "$USER_API/orders" -H "Authorization: Bearer $AT" \
  -H "Idempotency-Key: $IDEM_KEY" -H "Content-Type: application/json" \
  -d "{\"pickupAt\":\"$SLOT\"}")
ORDER_ID=$(echo "$LAST_RES" | jq -r '.data.id // empty')
ORDER_NUM=$(echo "$LAST_RES" | jq -r '.data.orderNumber // empty')
assert_ok "order (idem)" '[[ -n "$ORDER_ID" && -n "$ORDER_NUM" ]]' "orderNumber=$ORDER_NUM"

# ─── 10. 同じキー再送 → 同じ orderNumber (レスポンス再生) ────
LAST_RES=$(curl -s -X POST "$USER_API/orders" -H "Authorization: Bearer $AT" \
  -H "Idempotency-Key: $IDEM_KEY" -H "Content-Type: application/json" \
  -d "{\"pickupAt\":\"$SLOT\"}")
ORDER_NUM2=$(echo "$LAST_RES" | jq -r '.data.orderNumber // empty')
assert_ok "order replay" '[[ "$ORDER_NUM2" == "$ORDER_NUM" ]]' "same orderNumber=$ORDER_NUM2"

# ─── 11. エラー: 不正ステータス遷移 ─────────────────────────
ADMIN_RES=$(curl -s -X POST "$ADMIN_API/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD_PLAIN\"}")
ADMIN_TOKEN=$(echo "$ADMIN_RES" | jq -r '.data.token // empty')
LAST_RES="$ADMIN_RES"
assert_ok "admin login" '[[ -n "$ADMIN_TOKEN" ]]' "admin token (${ADMIN_TOKEN:0:12}...)"

# received → ready は不正 (received→preparing か cancelled のみ)
LAST_RES=$(curl -s -X PUT "$ADMIN_API/orders/$ORDER_ID/status" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"ready"}')
CODE=$(echo "$LAST_RES" | jq -r '.error.code // empty')
assert_ok "invalid transition" '[[ "$CODE" == "ORDER_INVALID_STATUS_TRANSITION" ]]' "code=$CODE"

# ─── 12. 正常な遷移 received → preparing → cancelled ─────────
LAST_RES=$(curl -s -X PUT "$ADMIN_API/orders/$ORDER_ID/status" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"preparing"}')
OK=$(echo "$LAST_RES" | jq -r '.success')
assert_ok "→ preparing" '[[ "$OK" == "true" ]]' "received→preparing"

LAST_RES=$(curl -s -X PUT "$ADMIN_API/orders/$ORDER_ID/status" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"cancelled"}')
OK=$(echo "$LAST_RES" | jq -r '.success')
assert_ok "→ cancelled" '[[ "$OK" == "true" ]]' "preparing→cancelled"

# ─── 13. refresh ────────────────────────────────────────────
LAST_RES=$(curl -s -X POST "$USER_API/auth/refresh" -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$RT\"}")
NEW_AT=$(echo "$LAST_RES" | jq -r '.data.accessToken // empty')
assert_ok "refresh" '[[ -n "$NEW_AT" && "$NEW_AT" != "$AT" ]]' "new accessToken (${NEW_AT:0:12}...)"
NEW_RT=$(echo "$LAST_RES" | jq -r '.data.refreshToken')

# ─── 14. logout ──────────────────────────────────────────────
LAST_RES=$(curl -s -X POST "$USER_API/auth/logout" -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$NEW_RT\"}")
OK=$(echo "$LAST_RES" | jq -r '.success')
assert_ok "logout" '[[ "$OK" == "true" ]]' ""

# ─── 15. logout 後 access token で /users/me → TOKEN_INVALID (sid 失効) ─
LAST_RES=$(curl -s -H "Authorization: Bearer $NEW_AT" "$USER_API/users/me")
CODE=$(echo "$LAST_RES" | jq -r '.error.code // empty')
assert_ok "post-logout 401" '[[ "$CODE" == "TOKEN_INVALID" ]]' "code=$CODE"

# ─── 完了 ───────────────────────────────────────────────
echo
if [[ "$FAILED" -eq 0 ]]; then
  printf "全 %d ステップ成功\n" "$STEP"
  exit 0
else
  printf "\033[31m%d / %d ステップ失敗\033[0m\n" "$FAILED" "$STEP"
  exit 1
fi
