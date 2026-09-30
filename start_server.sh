#!/usr/bin/env bash
# start_server.sh <x25519|mlkem> <port>
# Starts the nginx-pqc TLS1.3/HTTP2 server for the given key-exchange config.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_PREFIX="$PROJECT_DIR/nginx-pqc"
OSSL_LIB="$PROJECT_DIR/openssl-3.5/lib"
RUN_DIR="$PROJECT_DIR/run"
WWW_DIR="$PROJECT_DIR/www"
CERT_DIR="$NGINX_PREFIX/certs"

CONFIG="${1:?usage: start_server.sh <x25519|mlkem> <port>}"
PORT="${2:?usage: start_server.sh <x25519|mlkem> <port>}"

case "$CONFIG" in
  x25519) GROUP="X25519" ;;
  mlkem)  GROUP="${MLKEM_GROUP:-MLKEM512}" ;;
  *) echo "unknown config: $CONFIG (expected x25519|mlkem)" >&2; exit 1 ;;
esac

mkdir -p "$RUN_DIR"

CONF_FILE="$RUN_DIR/nginx-$CONFIG.conf"
PID_FILE="$RUN_DIR/nginx-$CONFIG.pid"
ERROR_LOG="$RUN_DIR/nginx-$CONFIG-error.log"
ACCESS_LOG="$RUN_DIR/nginx-$CONFIG-access.log"

sed \
  -e "s#__PID_FILE__#$PID_FILE#g" \
  -e "s#__ERROR_LOG__#$ERROR_LOG#g" \
  -e "s#__ACCESS_LOG__#$ACCESS_LOG#g" \
  -e "s#__NGINX_PREFIX__#$NGINX_PREFIX#g" \
  -e "s#__PORT__#$PORT#g" \
  -e "s#__CERT_DIR__#$CERT_DIR#g" \
  -e "s#__GROUP__#$GROUP#g" \
  -e "s#__WWW_DIR__#$WWW_DIR#g" \
  "$PROJECT_DIR/nginx.conf.template" > "$CONF_FILE"

# Stop any stale instance bound to this config's pid file first.
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  LD_LIBRARY_PATH="$OSSL_LIB" "$NGINX_PREFIX/sbin/nginx" -c "$CONF_FILE" -s stop 2>/dev/null || true
  sleep 1
fi

LD_LIBRARY_PATH="$OSSL_LIB" "$NGINX_PREFIX/sbin/nginx" -c "$CONF_FILE"

# Health check: wait for TLS handshake + HTTP/2 response to succeed.
# curl's default curve list does not include MLKEM512, so pass --curves explicitly
# (the system curl binary is only used here for the readiness probe, not for measurement).
for i in $(seq 1 30); do
  if LD_LIBRARY_PATH="$OSSL_LIB" "$NGINX_PREFIX/sbin/nginx" -t -c "$CONF_FILE" >/dev/null 2>&1 && \
     LD_LIBRARY_PATH="$OSSL_LIB" curl -s -k --http2 --curves "$GROUP" -o /dev/null -w '%{http_code}' "https://127.0.0.1:$PORT/" 2>/dev/null | grep -q '^200$'; then
    echo "server ready: config=$CONFIG group=$GROUP port=$PORT" >&2
    exit 0
  fi
  sleep 0.5
done

echo "server failed to become ready: config=$CONFIG port=$PORT" >&2
cat "$ERROR_LOG" >&2 || true
exit 1
