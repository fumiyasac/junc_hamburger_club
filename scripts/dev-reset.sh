#!/usr/bin/env bash
# ボリュームを捨ててバックエンドを再構築する。手元のデータは消える。
#
# 使い方: ./scripts/dev-reset.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/junc_hamburger_club_backend"

cd "$BACKEND_DIR"

echo "[dev-reset] ボリュームを削除します。手元のデータは消えます。"
docker compose down -v

"$SCRIPT_DIR/dev-up.sh"
