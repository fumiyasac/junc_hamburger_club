#!/usr/bin/env bash
# 既存ボリュームに未適用の init-db migration を流す。全て冪等 (CREATE IF NOT EXISTS 等)。
#
# 使い方:
#   ./scripts/dev-migrate.sh                           # 03_ 以降を全て順に流す
#   ./scripts/dev-migrate.sh 08_refresh_sessions.sql   # 特定ファイルだけ

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/junc_hamburger_club_backend"

cd "$BACKEND_DIR"

# .env は source すると引用符無しのスペース混じり値 (STORE_NAME 等) で壊れる。
# 必要キーだけを安全に取り出す。
_read_env() {
  local key="$1"
  [[ -f .env ]] || return 0
  grep -E "^${key}=" .env | tail -1 | sed "s/^${key}=//"
}
MYSQL_USER="${MYSQL_USER:-$(_read_env MYSQL_USER)}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-$(_read_env MYSQL_PASSWORD)}"
MYSQL_DATABASE="${MYSQL_DATABASE:-$(_read_env MYSQL_DATABASE)}"
: "${MYSQL_USER:=junc_user}"
: "${MYSQL_PASSWORD:=junc_password}"
: "${MYSQL_DATABASE:=junc_hamburger}"

run_sql() {
  local file="$1"
  echo "[dev-migrate] applying: $file"
  docker compose exec -T mysql sh -c \
    "mysql -u'${MYSQL_USER}' -p'${MYSQL_PASSWORD}' '${MYSQL_DATABASE}'" \
    < "init-db/$file"
}

if [[ $# -ge 1 ]]; then
  run_sql "$1"
  exit 0
fi

# 03_ 以降を順に適用 (01_schema / 02_seed_data は新規 volume 専用)
for f in init-db/0[3-9]_*.sql init-db/[1-9][0-9]_*.sql; do
  [[ -e "$f" ]] || continue
  run_sql "$(basename "$f")"
done

echo "[dev-migrate] 全 migration 適用完了"
