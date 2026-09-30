#!/usr/bin/env bash
# measure.sh <x25519|mlkem>
#
# Starts a TLS1.3/HTTP2 server (nginx 1.27.4 statically built against a
# project-local OpenSSL 3.5.4, see build/openssl-src and nginx-pqc/), runs a
# fixed h2load benchmark against it, tears the server down, and prints a
# structured JSON result line to stdout.
#
# Fixed parameters (must be identical between the two configs except for the
# TLS key-exchange group): concurrency 100, duration 30s, path "/", GET.
#
# Port: read from $PORT env var (default 8443). If the default port is busy
# during testing, re-invoke with PORT=<other> rather than editing this file.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OSSL_LIB="$PROJECT_DIR/openssl-3.5/lib"

CONFIG="${1:?usage: measure.sh <x25519|mlkem>}"
PORT="${PORT:-8443}"
CONCURRENCY=100
DURATION=30

case "$CONFIG" in
  x25519) GROUP="X25519" ;;
  mlkem)  GROUP="${MLKEM_GROUP:-MLKEM512}" ;;
  *) echo "unknown config: $CONFIG (expected x25519|mlkem)" >&2; exit 1 ;;
esac

cleanup() {
  "$PROJECT_DIR/stop_server.sh" "$CONFIG" >&2 || true
}
trap cleanup EXIT

echo "[measure.sh] starting server: config=$CONFIG port=$PORT group=$GROUP" >&2
"$PROJECT_DIR/start_server.sh" "$CONFIG" "$PORT" >&2

set -x
LD_LIBRARY_PATH="$OSSL_LIB" h2load \
  -c "$CONCURRENCY" \
  -D "$DURATION" \
  --groups="$GROUP" \
  "https://127.0.0.1:$PORT/" > "$PROJECT_DIR/run/h2load-$CONFIG.out" 2> "$PROJECT_DIR/run/h2load-$CONFIG.err"
set +x

H2LOAD_OUT="$PROJECT_DIR/run/h2load-$CONFIG.out"
cat "$H2LOAD_OUT" >&2

python3 "$PROJECT_DIR/parse_h2load.py" "$H2LOAD_OUT" "$CONFIG" "$GROUP" "$PORT"
