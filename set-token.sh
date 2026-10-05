#!/usr/bin/env bash
# After launching $FOUNT on Pons: prepares the admin Safe's timelock transaction that sets it (once) in DrawdownRetire.
#   ./set-token.sh 0xTOKEN
set -euo pipefail
cd "$(dirname "$0")"
[[ -n "${1:-}" ]] || { echo "usage: ./set-token.sh <\$FOUNT token address>" >&2; exit 1; }
[[ -d contracts/node_modules ]] || (cd contracts && npm ci --no-audit --no-fund)
eval "$(node tools/env.js)"
cd contracts
node scripts/govern.js set-token "$1"
