#!/usr/bin/env bash
# macOS / Linux 啟動腳本：優先 python3，其次 python，再來的 node
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
URL="http://localhost:${PORT}"

if command -v python3 >/dev/null 2>&1; then
  echo "使用 python3 啟動本機伺服器 → ${URL}"
  exec python3 -m http.server "${PORT}"
elif command -v python >/dev/null 2>&1; then
  echo "使用 python 啟動本機伺服器 → ${URL}"
  exec python -m SimpleHTTPServer "${PORT}"
elif command -v node >/dev/null 2>&1; then
  echo "使用 node 啟動本機伺服器 → ${URL}"
  exec node scripts/serve.js "${PORT}"
else
  echo "找不到 python3 / python / node。"
  echo "請安裝其中一個（推薦 Python 3 或 Node.js），或直接開終端機執行："
  echo "  python3 -m http.server 8080"
  exit 1
fi
