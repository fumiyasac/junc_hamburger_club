#!/usr/bin/env bash
# テストユーザーで login (未登録なら register)、access/refresh トークンを export。
# 引数に "admin" を渡すと admin もログインして ADMIN_TOKEN を export。
#
# 使い方:
#   source ./scripts/dev-login.sh          → $ACCESS_TOKEN $REFRESH_TOKEN
#   source ./scripts/dev-login.sh admin    → + $ADMIN_TOKEN
#
# .env から TEST_EMAIL / TEST_PASSWORD / ADMIN_EMAIL / ADMIN_PASSWORD_PLAIN を読む
# (TEST_EMAIL / TEST_PASSWORD 未設定時は test@example.com / password123 デフォルト)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/junc_hamburger_club_backend"
USER_API="${USER_API_URL:-http://localhost:3100/api/v1}"
ADMIN_API="${ADMIN_API_URL:-http://localhost:8081/api/v1/admin}"

# .env は source すると引用符なしのスペース混じり値で壊れる (STORE_NAME 等)。
# 必要キーだけを安全に読み出す。
_read_env() {
  local key="$1"
  [[ -f "$BACKEND_DIR/.env" ]] || return 0
  grep -E "^${key}=" "$BACKEND_DIR/.env" | tail -1 | sed "s/^${key}=//"
}
: "${TEST_EMAIL:=$(_read_env TEST_EMAIL)}"; : "${TEST_EMAIL:=test@example.com}"
: "${TEST_PASSWORD:=$(_read_env TEST_PASSWORD)}"; : "${TEST_PASSWORD:=password123}"
: "${ADMIN_EMAIL:=$(_read_env ADMIN_EMAIL)}"; : "${ADMIN_EMAIL:=admin@junc-hamburger.com}"

# Try login first
_RES="$(curl -s -X POST "$USER_API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")"
_OK=$(echo "$_RES" | jq -r '.success')

if [[ "$_OK" != "true" ]]; then
  _CODE=$(echo "$_RES" | jq -r '.error.code // empty')
  if [[ "$_CODE" == "USER_LOGIN_FAILED" ]]; then
    # 既存ユーザーだがパスワード不一致。別の TEST_PASSWORD か DB リセットが必要
    echo "[dev-login] $TEST_EMAIL は既に登録済みでパスワードが不一致です。"
    echo "  → TEST_PASSWORD を実際の値に設定するか、./scripts/dev-reset.sh を実行してください。"
    return 1 2>/dev/null || exit 1
  fi
  echo "[dev-login] user login failed, trying register..."
  _RES="$(curl -s -X POST "$USER_API/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"TestUser\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")"
  _OK=$(echo "$_RES" | jq -r '.success')
fi

if [[ "$_OK" != "true" ]]; then
  echo "[dev-login] user auth failed. Response:"
  echo "$_RES" | jq
  return 1 2>/dev/null || exit 1
fi

export ACCESS_TOKEN=$(echo "$_RES" | jq -r '.data.accessToken')
export REFRESH_TOKEN=$(echo "$_RES" | jq -r '.data.refreshToken')
echo "[dev-login] ACCESS_TOKEN set (${ACCESS_TOKEN:0:20}...)"
echo "[dev-login] REFRESH_TOKEN set (${REFRESH_TOKEN:0:20}...)"

# admin もログインする場合
if [[ "${1:-}" == "admin" ]]; then
  : "${ADMIN_EMAIL:=admin@junc-hamburger.com}"
  : "${ADMIN_PASSWORD_PLAIN:=admin1234}"
  _ARES="$(curl -s -X POST "$ADMIN_API/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD_PLAIN\"}")"
  _AOK=$(echo "$_ARES" | jq -r '.success')
  if [[ "$_AOK" != "true" ]]; then
    echo "[dev-login] admin login failed. ADMIN_PASSWORD_PLAIN ($ADMIN_PASSWORD_PLAIN) と .env の ADMIN_PASSWORD_HASH を確認"
    echo "$_ARES" | jq
  else
    export ADMIN_TOKEN=$(echo "$_ARES" | jq -r '.data.token')
    echo "[dev-login] ADMIN_TOKEN set (${ADMIN_TOKEN:0:20}...)"
  fi
fi
