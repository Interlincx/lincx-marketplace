#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== lint (check-plugin.mjs) ==="
node scripts/check-plugin.mjs

echo "=== unit (node --test tests/*.test.mjs) ==="
node --test tests/*.test.mjs

echo "== mcp tool references (repo-wide) =="
node ../../scripts/check-mcp-tool-refs.mjs

echo "✔ all green"
