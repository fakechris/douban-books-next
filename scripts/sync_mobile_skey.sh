#!/bin/sh
set -eu

SKEY="${WEREAD_SKEY:-${1:-}}"
VID="${WEREAD_VID:-${2:-}}"
SYNCKEY="${WEREAD_SYNCKEY:-0}"
LECTURE_SYNCKEY="${WEREAD_LECTURE_SYNCKEY:-0}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${WEREAD_SYNC_OUT_DIR:-$ROOT_DIR/runtime/weread-mobile-sync}"
DATE="$(date +%Y%m%dT%H%M%S)"
OUT_JSON="$OUT_DIR/shelfSync_${DATE}.json"
OUT_HEADERS="$OUT_DIR/shelfSync_${DATE}.headers.txt"

if [ -z "$SKEY" ]; then
  echo "Usage: WEREAD_SKEY=<skey> WEREAD_VID=<vid> ./scripts/sync_mobile_skey.sh" >&2
  echo "   or: ./scripts/sync_mobile_skey.sh <skey> [vid]" >&2
  exit 2
fi

mkdir -p "$OUT_DIR"

curl -sS --http1.1 --compressed \
  -D "$OUT_HEADERS" \
  -o "$OUT_JSON" \
  -w "status=%{http_code} time=%{time_total} size=%{size_download} output=$OUT_JSON\n" \
  "https://i.weread.qq.com/shelf/sync?synckey=$SYNCKEY&lectureSynckey=$LECTURE_SYNCKEY" \
  -H "Host: i.weread.qq.com" \
  -H "channelId: AppStore" \
  -H "Accept: */*" \
  -H "vid: $VID" \
  -H "Accept-Language: zh-Hans-CN;q=1, en-CN;q=0.9" \
  -H "basever: 10.1.0.80" \
  -H "User-Agent: WeRead/10.1.0 (iPhone; iOS 26.4.2; Scale/3.00)" \
  -H "skey: $SKEY" \
  -H "v: 10.1.0.80" \

if command -v jq >/dev/null 2>&1; then
  jq '{errcode, errmsg, synckey, bookCount, pureBookCount, books: (.books // [] | length), bookProgress: (.bookProgress // [] | length), supplyBooks: (.supplyBooks // [] | length), albums: (.albums // [] | length), archive: (.archive // [] | length), mp: (has("mp"))}' "$OUT_JSON" || true
fi
