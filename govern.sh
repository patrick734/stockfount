#!/usr/bin/env bash
# Timelock actions for the admin Safe (read-only; writes Safe Transaction Builder files to safe-txs/).
#   ./govern.sh status          what is scheduled, ready or executed
#   ./govern.sh register-pool   after $FOUNT graduates on Pons: start buy-and-burn
set -euo pipefail
cd "$(dirname "$0")"
[[ -d contracts/node_modules ]] || (cd contracts && npm ci --no-audit --no-fund)
eval "$(node tools/env.js)"
cd contracts
node scripts/govern.js "${@:-status}"
