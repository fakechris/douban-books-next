#!/bin/sh
set -eu

SKEY="${WEREAD_SKEY:-${1:-}}"
REQUEST_JSON="${WEREAD_SYNCBOOK_REQUEST:-${2:-}}"
VID="${WEREAD_VID:-}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${WEREAD_SYNC_OUT_DIR:-$ROOT_DIR/runtime/weread-mobile-sync}"
DATE="$(date +%Y%m%dT%H%M%S)_$$"
OUT_JSON="$OUT_DIR/syncbook_${DATE}.json"
OUT_HEADERS="$OUT_DIR/syncbook_${DATE}.headers.txt"

if [ -z "$SKEY" ] || [ -z "$REQUEST_JSON" ]; then
  echo "Usage: ./scripts/syncbook_mobile_skey.sh <skey> <request.json>" >&2
  echo "   or: WEREAD_SKEY=<skey> WEREAD_SYNCBOOK_REQUEST=<request.json> ./scripts/syncbook_mobile_skey.sh" >&2
  exit 2
fi

if [ ! -f "$REQUEST_JSON" ]; then
  echo "Request JSON not found: $REQUEST_JSON" >&2
  exit 2
fi

mkdir -p "$OUT_DIR"

curl -sS --http1.1 --compressed \
  -D "$OUT_HEADERS" \
  -o "$OUT_JSON" \
  -w "status=%{http_code} time=%{time_total} size=%{size_download} output=$OUT_JSON\n" \
  -X POST "https://i.weread.qq.com/shelf/syncbook" \
  -H "Host: i.weread.qq.com" \
  -H "channelId: AppStore" \
  -H "Accept: */*" \
  -H "vid: $VID" \
  -H "Accept-Encoding: gzip, deflate, br" \
  -H "Accept-Language: zh-Hans-CN;q=1, en-CN;q=0.9" \
  -H "Content-Type: application/json" \
  -H "basever: 10.1.0.80" \
  -H "User-Agent: WeRead/10.1.0 (iPhone; iOS 26.4.2; Scale/3.00)" \
  -H "skey: $SKEY" \
  -H "v: 10.1.0.80" \
  --data-binary "@$REQUEST_JSON"

if command -v jq >/dev/null 2>&1; then
  jq '{errcode, errmsg, books: (.books // [] | length), bookInfos: (.bookInfos // [] | length), albums: (.albums // [] | length), albumInfos: (.albumInfos // [] | length)}' "$OUT_JSON" || true
fi
