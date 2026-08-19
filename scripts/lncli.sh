#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

exec "$PROJECT_DIR/.tools/lnd/lncli" \
  --lnddir="$PROJECT_DIR/.lnd-data" \
  --rpcserver=127.0.0.1:10009 \
  "$@"
