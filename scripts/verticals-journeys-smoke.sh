#!/usr/bin/env bash
# Verticals journey smoke (URI /v1): local markets, liquor, gas, events,
# age-verification, and admin CRUD probes.
# Seeds: 003_auth_test_user, 004_admin_test_user, 006_verticals_events
# Assumes an already-running API at $BASE (no server is started here).
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
DEVICE="verticals-smoke-$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0

EVENT_ID='30000000-0000-4000-8000-000000000001'
MARKET_ID='20000000-0000-4000-8000-000000000001'
LIQUOR_ID='20000000-0000-4000-8000-000000000002'
GAS_ID='20000000-0000-4000-8000-000000000003'
TICKET_TYPE_ID='32000000-0000-4000-8000-000000000001'
FREE_TICKET_TYPE_ID='32000000-0000-4000-8000-000000000002'

json_get() {
  python3 - "$1" "$2" <<'PY'
import json,sys
data=json.load(open(sys.argv[1]))
cur=data
for part in sys.argv[2].split('.'):
    if part.endswith(']'):
        name,idx=part[:-1].split('[')
        cur=cur[name][int(idx)]
    else:
        cur=cur[part]
print('' if cur is None else cur)
PY
}

expect_http() {
  local name="$1" want="$2"; shift 2
  echo; echo "=== $name (expect HTTP $want) ==="
  local code; code="$(curl -sS -o "$TMP/out.json" -w '%{http_code}' "$@")"
  echo "HTTP $code"
  python3 -m json.tool <"$TMP/out.json" 2>/dev/null | head -40 || cat "$TMP/out.json" || true
  if [[ "$want" == *'|'* ]]; then
    IFS='|' read -r -a wants <<<"$want"
    local ok=0
    for w in "${wants[@]}"; do [[ "$code" == "$w" ]] && ok=1; done
    if [[ "$ok" -eq 1 ]]; then echo OK; pass=$((pass+1)); else echo FAIL; fail=$((fail+1)); fi
  elif [[ "$code" == "$want" ]]; then
    echo OK; pass=$((pass+1))
  else
    echo FAIL; fail=$((fail+1))
  fi
}

# --- Local markets ---
expect_http 'markets categories' 200 "$BASE/v1/local-markets/categories"
expect_http 'markets feed' 200 "$BASE/v1/local-markets/feed?lat=-0.0917&lng=34.768"
expect_http 'markets list' 200 "$BASE/v1/local-markets?page=1&limit=10"
expect_http 'market detail' 200 "$BASE/v1/local-markets/${MARKET_ID}"
expect_http 'market products' 200 "$BASE/v1/local-markets/${MARKET_ID}/products?page=1&limit=10"

# --- Liquor ---
expect_http 'liquor categories' 200 "$BASE/v1/liquor-stores/categories"
expect_http 'liquor feed' 200 "$BASE/v1/liquor-stores/feed?lat=-0.0917&lng=34.768"
expect_http 'liquor products' 200 "$BASE/v1/liquor-stores/products?page=1&limit=10"
expect_http 'liquor store detail' 200 "$BASE/v1/liquor-stores/${LIQUOR_ID}"

# --- Gas ---
expect_http 'gas categories' 200 "$BASE/v1/gas-delivery/categories"
expect_http 'gas feed' 200 "$BASE/v1/gas-delivery/feed?lat=-0.0917&lng=34.768"
expect_http 'gas products' 200 "$BASE/v1/gas-delivery/products?page=1&limit=10"
expect_http 'gas store detail' 200 "$BASE/v1/gas-delivery/stores/${GAS_ID}"

# --- Events discovery ---
expect_http 'events categories' 200 "$BASE/v1/events/categories"
expect_http 'events feed' 200 "$BASE/v1/events/feed?lat=-0.0917&lng=34.768"
expect_http 'events list' 200 "$BASE/v1/events?page=1&limit=10&sort=soonest"
expect_http 'event detail' 200 "$BASE/v1/events/${EVENT_ID}"

# --- Auth: demo customer ---
curl -sS -o "$TMP/login.json" -H 'Content-Type: application/json' -H "X-Device-Id: $DEVICE" \
  -d '{"email":"demo@daladrop.test","password":"TestPass123!@#"}' "$BASE/v1/auth/login" || true
TOKEN="$(json_get "$TMP/login.json" token 2>/dev/null || echo '')"
USER_ID="$(json_get "$TMP/login.json" user.id 2>/dev/null || echo '')"

if [[ -n "$TOKEN" && -n "$USER_ID" ]]; then
  AUTH=(-H "Authorization: Bearer $TOKEN" -H "X-Device-Id: $DEVICE")
  expect_http 'age-verification status' 200 "${AUTH[@]}" \
    "$BASE/v1/customer/${USER_ID}/age-verification"
  expect_http 'my tickets' 200 "${AUTH[@]}" "$BASE/v1/events/my-tickets"
  expect_http 'buy free ticket' 200 "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d "{\"ticketTypeId\":\"${FREE_TICKET_TYPE_ID}\",\"quantity\":1}" \
    "$BASE/v1/events/${EVENT_ID}/buy"
  expect_http 'buy paid ticket (pending payment)' 200 "${AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -d "{\"ticketTypeId\":\"${TICKET_TYPE_ID}\",\"quantity\":1,\"phone\":\"254700000001\"}" \
    "$BASE/v1/events/${EVENT_ID}/buy"
else
  echo; echo "SKIP customer auth journeys (login failed)"; fail=$((fail+1))
fi

# --- Admin ---
curl -sS -o "$TMP/admin.json" -H 'Content-Type: application/json' -H "X-Device-Id: $DEVICE-admin" \
  -d '{"email":"admin@daladrop.test","password":"TestPass123!@#"}' "$BASE/v1/auth/login" || true
ADMIN_TOKEN="$(json_get "$TMP/admin.json" token 2>/dev/null || echo '')"

if [[ -n "$ADMIN_TOKEN" ]]; then
  AAUTH=(-H "Authorization: Bearer $ADMIN_TOKEN" -H "X-Device-Id: $DEVICE-admin")
  expect_http 'admin module categories MARKET' 200 "${AAUTH[@]}" \
    "$BASE/v1/admin/module-categories?moduleType=MARKET"
  expect_http 'admin store products MARKET' 200 "${AAUTH[@]}" \
    "$BASE/v1/admin/stores/${MARKET_ID}/products"
  expect_http 'admin events list' 200 "${AAUTH[@]}" "$BASE/v1/admin/events"
  expect_http 'admin age verifications' 200 "${AAUTH[@]}" \
    "$BASE/v1/admin/age-verifications"
else
  echo; echo "SKIP admin journeys (login failed)"; fail=$((fail+1))
fi

echo
echo "Passed: $pass  Failed: $fail"
[[ "$fail" -eq 0 ]]
