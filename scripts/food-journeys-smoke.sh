#!/usr/bin/env bash
# Food / restaurants journey smoke (URI /v1).
# Seeds: 003_auth_test_user, 004_admin_test_user, 005_food_restaurants
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
DEVICE="food-smoke-$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
STORE_ID='ffffffff-ffff-4fff-8fff-ffffffffffff'

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

expect_http 'food categories' 200 "$BASE/v1/food/categories"
expect_http 'restaurants discover' 200 \
  "$BASE/v1/restaurants?discover=1&page=1&limit=10&sort=rating&lat=-0.0917&lng=34.768"
expect_http 'restaurants search filter' 200 \
  "$BASE/v1/restaurants?discover=1&category=Fast%20Food&search=java&openNow=1&minRating=4&page=1&limit=10"
expect_http 'food feed' 200 "$BASE/v1/food/feed?lat=-0.0917&lng=34.768"
expect_http 'restaurant detail' 200 "$BASE/v1/restaurants/${STORE_ID}"
expect_http 'restaurant menu' 200 "$BASE/v1/restaurants/${STORE_ID}/menu"

# auth + favourites + admin
curl -sS -o "$TMP/login.json" -H 'Content-Type: application/json' -H "X-Device-Id: $DEVICE" \
  -d '{"email":"demo@daladrop.test","password":"TestPass123!@#"}' "$BASE/v1/auth/login"
TOKEN="$(json_get "$TMP/login.json" token)"
USER_ID="$(json_get "$TMP/login.json" user.id)"
AUTH=(-H "Authorization: Bearer $TOKEN" -H "X-Device-Id: $DEVICE")

expect_http 'save restaurant favourite' '200|201' "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"restaurant\",\"id\":\"${STORE_ID}\"}" \
  "$BASE/v1/customer/${USER_ID}/saved-items"
expect_http 'list restaurant favourites' 200 "${AUTH[@]}" \
  "$BASE/v1/customer/${USER_ID}/saved-items?type=restaurant"
expect_http 'restaurants with favourite flag' 200 "${AUTH[@]}" \
  "$BASE/v1/restaurants?discover=1&page=1&limit=10"

curl -sS -o "$TMP/admin.json" -H 'Content-Type: application/json' -H "X-Device-Id: ${DEVICE}-admin" \
  -d '{"email":"admin@daladrop.test","password":"TestPass123!@#"}' "$BASE/v1/auth/login"
ADMIN_TOKEN="$(json_get "$TMP/admin.json" token)"
ADMIN=(-H "Authorization: Bearer $ADMIN_TOKEN" -H "X-Device-Id: ${DEVICE}-admin")

expect_http 'admin list merchants' 200 "${ADMIN[@]}" "$BASE/v1/admin/merchants"
expect_http 'admin list stores' 200 "${ADMIN[@]}" "$BASE/v1/admin/stores?storeType=RESTAURANT"
expect_http 'admin food categories' 200 "${ADMIN[@]}" "$BASE/v1/admin/food-categories"
expect_http 'admin store menu' 200 "${ADMIN[@]}" "$BASE/v1/admin/stores/${STORE_ID}/menu"
expect_http 'admin merchant kyc' 200 "${ADMIN[@]}" \
  "$BASE/v1/admin/merchants/dddddddd-dddd-4ddd-8ddd-dddddddddddd/kyc"

echo; echo "Passed: $pass  Failed: $fail"
[[ "$fail" -eq 0 ]]
