#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

exec "$PROJECT_DIR/.tools/lnd/lnd" \
  --lnddir="$PROJECT_DIR/.lnd-data" \
  --configfile="$PROJECT_DIR/.lnd-data/lnd.conf"

