#!/usr/bin/env bash
# Conformance check for the oEmbed provider (HER-402).
#
# §7.4.2 lists five requirements and warns that "every one of those is a place
# where a multi-tenant platform accidentally breaks embedding, so treat them as
# acceptance criteria". This script is those criteria, runnable.
#
#   ./scripts/check-oembed.sh [base-url] [venue-slug] [object-slug] [scene-slug]
#
# Defaults target the local dev server and the demo seed.
set -uo pipefail

BASE="${1:-http://localhost:3005}"
VENUE="${2:-demo-museum}"
OBJECT="${3:-demo-kore}"
SCENE="${4:-demo-classical-gallery-scene}"

pass=0; fail=0
check() { # check <label> <actual> <expected>
  if [ "$2" = "$3" ]; then printf '  ok    %-52s %s\n' "$1" "$2"; pass=$((pass+1));
  else printf '  FAIL  %-52s %s (expected %s)\n' "$1" "$2" "$3"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }
enc() { python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1"; }
field() { curl -s "$1" | python3 -c "import sys,json;print(json.load(sys.stdin).get(sys.argv[1],''))" "$2" 2>/dev/null; }

CANON="$BASE/v/$VENUE/o/$OBJECT"
OE="$BASE/api/oembed?url=$(enc "$CANON")"

echo "oEmbed conformance — $BASE"
echo
echo "1. Stable public URL pattern"
check "canonical object page" "$(code "$CANON")" 200
check "canonical scene page" "$(code "$BASE/v/$VENUE/s/$SCENE")" 200

echo "2. Working discovery endpoint"
check "provider returns 200" "$(code "$OE")" 200
if curl -s "$CANON" | grep -q 'type="application/json+oembed"'; then
  printf '  ok    %-52s present\n' "discovery <link> on canonical page"; pass=$((pass+1))
else
  printf '  FAIL  %-52s missing\n' "discovery <link> on canonical page"; fail=$((fail+1))
fi

echo "3. Rich type with correct dimensions"
check "type" "$(field "$OE" type)" rich
check "version" "$(field "$OE" version)" 1.0
check "default width" "$(field "$OE" width)" 640
check "maxwidth honoured as a ceiling" "$(field "$OE&maxwidth=320" width)" 320
check "maxwidth above default is capped" "$(field "$OE&maxwidth=4000" width)" 640
check "absurdly small maxwidth is floored" "$(field "$OE&maxwidth=10" width)" 240

echo "4. No authentication, no tenant login wall"
check "provider, unauthenticated" "$(code "$OE")" 200
check "embed route, unauthenticated" "$(code "$BASE/embed/v/$VENUE/o/$OBJECT")" 200
check "scene embed, unauthenticated" "$(code "$BASE/embed/v/$VENUE/s/$SCENE")" 200

echo "5. Cross-origin iframe safety"
EH=$(curl -s -D- -o /dev/null "$BASE/embed/v/$VENUE/o/$OBJECT")
if grep -qi "frame-ancestors \*" <<<"$EH"; then
  printf '  ok    %-52s frame-ancestors *\n' "embed is framable anywhere"; pass=$((pass+1))
else
  printf '  FAIL  %-52s missing\n' "embed is framable anywhere"; fail=$((fail+1))
fi
OH=$(curl -s -D- -o /dev/null "$BASE/org/x")
if grep -qi "frame-ancestors 'none'" <<<"$OH"; then
  printf '  ok    %-52s frame-ancestors none\n' "console is NOT framable"; pass=$((pass+1))
else
  printf '  FAIL  %-52s missing\n' "console is NOT framable"; fail=$((fail+1))
fi

echo "Rejections — a provider must not answer for URLs it does not own"
check "foreign URL" "$(code "$BASE/api/oembed?url=$(enc 'https://sketchfab.com/3d-models/x')")" 404
check "unknown object" "$(code "$BASE/api/oembed?url=$(enc "/v/$VENUE/o/nope")")" 404
check "unsupported format" "$(code "$OE&format=xml")" 501
check "missing url param" "$(code "$BASE/api/oembed")" 400

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
