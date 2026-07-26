#!/usr/bin/env bash
# Profile / users / places / admin freeze journey smoke tests (URI /v1).
# Prerequisites: API running, demo + admin seeds applied.
#   psql "$DATABASE_URL" -f docs/database/seeds/003_auth_test_user.sql
#   psql "$DATABASE_URL" -f docs/database/seeds/004_admin_test_user.sql
# Usage:
#   bash scripts/profile-journeys-smoke.sh

set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
DEVICE="profile-smoke-$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PNG="$TMP/pixel.png"
# Minimal valid 1x1 PNG
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' >"$PNG"

pass=0
fail=0

json_get() {
  python3 - "$1" "$2" <<'PY'
import json,sys
data=json.load(open(sys.argv[1]))
cur=data
for part in sys.argv[2].split('.'):
    cur=cur[part]
print(cur if cur is not None else '')
PY
}

expect_http() {
  local name="$1" want="$2"
  shift 2
  echo
  echo "=== $name (expect HTTP $want) ==="
  local code
  code="$(curl -sS -o "$TMP/out.json" -w '%{http_code}' "$@")"
  echo "HTTP $code"
  python3 -m json.tool <"$TMP/out.json" 2>/dev/null || cat "$TMP/out.json" || true
  if [[ "$code" == "$want" ]]; then
    echo OK
    pass=$((pass + 1))
  else
    echo "FAIL expected $want"
    fail=$((fail + 1))
  fi
}

login() {
  local email="$1" password="$2" out="$3"
  curl -sS -o "$out" -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -H "X-Device-Id: $DEVICE" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    "$BASE/v1/auth/login"
}

echo "Logging in demo customer..."
code="$(login 'demo@daladrop.test' 'TestPass123!@#' "$TMP/login.json")"
[[ "$code" == "200" || "$code" == "201" ]] || { echo "demo login failed HTTP $code"; cat "$TMP/login.json"; exit 1; }
TOKEN="$(json_get "$TMP/login.json" token)"
USER_ID="$(json_get "$TMP/login.json" user.id)"
AUTH=(-H "Authorization: Bearer $TOKEN" -H "X-Device-Id: $DEVICE")

expect_http 'GET /user/me' 200 "${AUTH[@]}" "$BASE/v1/user/me"
expect_http 'PATCH update-profile' 200 "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -X PATCH \
  -d '{"firstName":"Demo","lastName":"Customer","phone":"0712345678"}' \
  "$BASE/v1/user/update-profile"

expect_http 'POST update-password rejects same password' 400 "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"currentPassword":"TestPass123!@#","newPassword":"TestPass123!@#"}' \
  "$BASE/v1/user/update-password"

expect_http 'POST update-password' 200 "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"currentPassword":"TestPass123!@#","newPassword":"TestPass123!@#x"}' \
  "$BASE/v1/user/update-password"

# Restore original password for later login checks
expect_http 'POST update-password restore' 200 "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"currentPassword":"TestPass123!@#x","newPassword":"TestPass123!@#"}' \
  "$BASE/v1/user/update-password"

expect_http 'POST profile photo' 200 "${AUTH[@]}" \
  -F "file=@${PNG};type=image/png" \
  "$BASE/v1/user/${USER_ID}/photo"

expect_http 'GET places' 200 "${AUTH[@]}" "$BASE/v1/customer/me/places"
expect_http 'PUT places' 200 "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -X PUT \
  -d '{"places":[{"label":"Home","address":"Nairobi CBD","icon":"home","pinned":true}]}' \
  "$BASE/v1/customer/me/places"
expect_http 'GET stats' 200 "${AUTH[@]}" "$BASE/v1/customer/${USER_ID}/stats"
expect_http 'GET history' 200 "${AUTH[@]}" "$BASE/v1/customer/${USER_ID}/history"
expect_http 'POST uploads/public' 200 "${AUTH[@]}" \
  -F 'folder=public' \
  -F "file=@${PNG};type=image/png" \
  "$BASE/v1/uploads/public"
expect_http 'uploads/public requires auth' 401 \
  -F 'folder=public' \
  -F "file=@${PNG};type=image/png" \
  "$BASE/v1/uploads/public"

echo "Logging in admin..."
code="$(login 'admin@daladrop.test' 'TestPass123!@#' "$TMP/admin.json")"
[[ "$code" == "200" || "$code" == "201" ]] || { echo "admin login failed HTTP $code"; cat "$TMP/admin.json"; exit 1; }
ADMIN_TOKEN="$(json_get "$TMP/admin.json" token)"
ADMIN=(-H "Authorization: Bearer $ADMIN_TOKEN" -H "X-Device-Id: $DEVICE-admin")

expect_http 'admin list users' 200 "${ADMIN[@]}" "$BASE/v1/admin/users?q=demo"
expect_http 'admin freeze demo' 200 "${ADMIN[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"smoke-freeze"}' \
  "$BASE/v1/admin/users/${USER_ID}/freeze"

expect_http 'frozen user knocked out' 401 "${AUTH[@]}" "$BASE/v1/user/me"
expect_http 'frozen user cannot login' 401 \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: $DEVICE" \
  -d '{"email":"demo@daladrop.test","password":"TestPass123!@#"}' \
  "$BASE/v1/auth/login"

expect_http 'admin restore demo' 200 "${ADMIN[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"smoke-restore"}' \
  "$BASE/v1/admin/users/${USER_ID}/restore"

code="$(login 'demo@daladrop.test' 'TestPass123!@#' "$TMP/login2.json")"
[[ "$code" == "200" || "$code" == "201" ]] || { echo "re-login failed"; exit 1; }
TOKEN2="$(json_get "$TMP/login2.json" token)"
AUTH2=(-H "Authorization: Bearer $TOKEN2" -H "X-Device-Id: $DEVICE")
expect_http 'restored user me' 200 "${AUTH2[@]}" "$BASE/v1/user/me"

echo
echo "Passed: $pass  Failed: $fail"
[[ "$fail" -eq 0 ]]
