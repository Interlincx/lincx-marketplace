#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== unit tests =="
node --test tests/*.test.mjs

echo "== structural lint =="
node scripts/check-plugin.mjs

echo "== mcp tool references (repo-wide) =="
node ../../scripts/check-mcp-tool-refs.mjs

echo "all tests passed"
