#!/usr/bin/env bash
# バックエンドを起動 + ヘルスチェックまで。既存ボリュームは保持する。
#
# 使い方:
#   ./scripts/dev-up.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/junc_hamburger_club_backend"

cd "$BACKEND_DIR"

# .env の存在確認
if [[ ! -f .env ]]; then
  echo "[dev-up] .env が見つかりません。.env.example からコピーします。"
  cp .env.example .env
  echo "[dev-up] JWT_SECRET を 32 文字以上に差し替えてください。生成例: openssl rand -base64 48"
fi

echo "[dev-up] docker compose up -d --build"
docker compose up -d --build

echo "[dev-up] MySQL healthy 待機..."
until [[ "$(docker inspect -f '{{.State.Health.Status}}' junc_mysql 2>/dev/null)" == "healthy" ]]; do
  sleep 2
done
echo "[dev-up] MySQL OK"

sleep 2

echo "[dev-up] user-api /health"
curl -sf http://localhost:3100/health > /dev/null && echo "  OK" || {
  echo "  NG (ログ: docker compose logs user-api --tail=30)"
  docker compose logs user-api --tail=30
  exit 1
}

echo "[dev-up] admin-api /health"
curl -sf http://localhost:8081/health > /dev/null && echo "  OK" || {
  echo "  NG (ログ: docker compose logs admin-api --tail=30)"
  docker compose logs admin-api --tail=30
  exit 1
}

echo "[dev-up] 完了。URL:"
echo "  user-api:      http://localhost:3100"
echo "  user-api docs: http://localhost:3100/api-docs"
echo "  admin-api:     http://localhost:8081"
