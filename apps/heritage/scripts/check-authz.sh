#!/usr/bin/env bash
#
# Regression guard for the venue-id existence oracle.
#
# `requireVenueAccess` once resolved the venue before authenticating, so an
# unauthenticated caller got 404 for an id that did not exist and 401 for one
# that did. That difference is enough to enumerate every tenant's venue ids
# from outside. The fix (5117cba4) authenticates first; this asserts the
# behaviour stays that way, because the bug is invisible in any test that only
# checks "unauthorised requests are refused".
#
# Requires the app running on $BASE (default http://localhost:3005).
set -uo pipefail

BASE="${BASE:-http://localhost:3005}"
pass=0
fail=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  ok    %-52s %s\n' "$label" "$actual"
    pass=$((pass + 1))
  else
    printf '  FAIL  %-52s %s (expected %s)\n' "$label" "$actual" "$expected"
    fail=$((fail + 1))
  fi
}

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

REAL_VENUE="${REAL_VENUE:-}"
if [ -z "$REAL_VENUE" ]; then
  # Any published venue will do; the point is that it exists.
  REAL_VENUE=$(curl -s "$BASE/v/demo-museum" >/dev/null 2>&1 && echo "cmt7h7gr40008xpt8tkohjmyb")
fi
FAKE_VENUE="cxxxxxxxxxxxxxxxxxxxxxxxx"

echo "Existence oracle — an unauthenticated caller must not be able to tell"
echo "a real venue id from an invented one."

for path in "" "/spaces" "/objects" "/scenes" "/representations" "/proxies" "/tours"; do
  real=$(code "$BASE/api/venues/$REAL_VENUE$path")
  fake=$(code "$BASE/api/venues/$FAKE_VENUE$path")
  check "GET /api/venues/{real}$path" 401 "$real"
  check "GET /api/venues/{fake}$path" 401 "$fake"
  if [ "$real" != "$fake" ]; then
    printf '  FAIL  %-52s real=%s fake=%s\n' "responses are indistinguishable$path" "$real" "$fake"
    fail=$((fail + 1))
  fi
done

echo
echo "Writes are refused the same way."
check "POST /api/venues/{real}/objects" 401 \
  "$(code -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/api/venues/$REAL_VENUE/objects")"
check "POST /api/venues/{fake}/objects" 401 \
  "$(code -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/api/venues/$FAKE_VENUE/objects")"

echo
echo "The console is not reachable unauthenticated."
signin=$(code "$BASE/org")
check "GET /org redirects to sign-in" 307 "$signin"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
