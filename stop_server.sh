#!/usr/bin/env bash
# stop_server.sh <x25519|mlkem>
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_PREFIX="$PROJECT_DIR/nginx-pqc"
OSSL_LIB="$PROJECT_DIR/openssl-3.5/lib"
RUN_DIR="$PROJECT_DIR/run"

CONFIG="${1:?usage: stop_server.sh <x25519|mlkem>}"
CONF_FILE="$RUN_DIR/nginx-$CONFIG.conf"
PID_FILE="$RUN_DIR/nginx-$CONFIG.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  LD_LIBRARY_PATH="$OSSL_LIB" "$NGINX_PREFIX/sbin/nginx" -c "$CONF_FILE" -s stop || true
  sleep 0.5
fi
rm -f "$PID_FILE"
echo "stopped: $CONFIG" >&2
