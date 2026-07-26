#!/usr/bin/env bash
# One-shot auth journey smoke test for DalaDrop API (URI version /v1).
# Usage:
#   bash scripts/auth-journeys-smoke.sh
# Optional:
#   BASE=http://localhost:3000 bash scripts/auth-journeys-smoke.sh

set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
DEVICE="cli-smoke-$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

json_get() {
  local file="$1"
  local expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json,sys
data=json.load(open(sys.argv[1]))
expr=sys.argv[2]
cur=data
for part in expr.split('.'):
    if part.endswith(']'):
        name, idx = part[:-1].split('[')
        cur = cur[name][int(idx)]
    else:
        cur = cur[part]
print(cur if cur is not None else '')
PY
}

step() {
  local name="$1"
  shift
  echo
  echo "=== $name ==="
  if "$@" >"$TMP/out.json" 2>"$TMP/err.txt"; then
    echo "OK"
    python3 -m json.tool <"$TMP/out.json" 2>/dev/null || cat "$TMP/out.json"
    pass=$((pass + 1))
  else
    echo "FAIL (exit $?)"
    cat "$TMP/err.txt" || true
    cat "$TMP/out.json" || true
    fail=$((fail + 1))
    return 1
  fi
}

expect_http() {
  local name="$1"
  local want="$2"
  shift 2
  echo
  echo "=== $name (expect HTTP $want) ==="
  local code
  code="$(curl -sS -o "$TMP/out.json" -w '%{http_code}' "$@")"
  echo "HTTP $code"
  python3 -m json.tool <"$TMP/out.json" 2>/dev/null || cat "$TMP/out.json"
  if [[ "$code" == "$want" ]]; then
    echo "OK"
    pass=$((pass + 1))
  else
    echo "FAIL expected $want"
    fail=$((fail + 1))
    return 1
  fi
}

hash_otp() {
  local code="$1"
  node -e '
    const crypto = require("crypto");
    require("dotenv").config({ quiet: true });
    const secret = process.env.JWT_SECRET || "";
    process.stdout.write(
      crypto.createHmac("sha256", secret).update(process.argv[1]).digest("hex"),
    );
  ' "$code"
}

force_otp() {
  local identifier="$1"
  local purpose="$2"
  local code="$3"
  local digest
  digest="$(hash_otp "$code")"
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
    "UPDATE otp_challenges
     SET code_hash = '$digest',
         attempts = 0,
         verified_at = NULL,
         consumed_at = NULL,
         expires_at = NOW() + INTERVAL '10 minutes'
     WHERE id = (
       SELECT id FROM otp_challenges
       WHERE identifier = '$identifier' AND purpose = '$purpose'::\"OtpPurpose\"
       ORDER BY created_at DESC
       LIMIT 1
     );" >/dev/null
}

totp_now() {
  local secret="$1"
  node - <<PY
const { generate } = require('otplib');
generate({ secret: '$secret' }).then((t) => process.stdout.write(t));
PY
}

echo "Base URL: $BASE"
echo "Device:   $DEVICE"

# 0) Health (unversioned)
expect_http "Health" 200 "$BASE/health" || true

# 1) Login success
expect_http "Login success" 200 \
  -X POST "$BASE/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: $DEVICE" \
  -d '{"email":"demo@daladrop.test","password":"TestPass123!@#"}' || true
cp "$TMP/out.json" "$TMP/login.json"
TOKEN="$(json_get "$TMP/login.json" token || true)"
REFRESH="$(json_get "$TMP/login.json" refreshToken || true)"
SESSION="$(json_get "$TMP/login.json" sessionId || true)"

# 2) Login failure
expect_http "Login failure" 401 \
  -X POST "$BASE/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: $DEVICE" \
  -d '{"email":"demo@daladrop.test","password":"WrongPass123!@#"}' || true

# 3) Refresh
expect_http "Refresh session" 200 \
  -X POST "$BASE/v1/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SESSION\",\"refreshToken\":\"$REFRESH\"}" || true
cp "$TMP/out.json" "$TMP/refresh.json"
TOKEN="$(json_get "$TMP/refresh.json" token || true)"
REFRESH="$(json_get "$TMP/refresh.json" refreshToken || true)"
SESSION="$(json_get "$TMP/refresh.json" sessionId || true)"

# 4) Update phone
expect_http "Update phone" 200 \
  -X PUT "$BASE/v1/user/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"phone":"0712345678"}' || true

# 5) Legal acceptances
expect_http "Legal acceptances" 200 \
  "$BASE/v1/legal/acceptances" \
  -H "Authorization: Bearer $TOKEN" || true

# 6) TOTP enroll
expect_http "TOTP enroll" 200 \
  -X POST "$BASE/v1/auth/mfa/totp/enroll" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"label":"CLI"}' || true
cp "$TMP/out.json" "$TMP/enroll.json"
FACTOR="$(json_get "$TMP/enroll.json" factorId || true)"
SECRET="$(json_get "$TMP/enroll.json" secret || true)"
CODE="$(totp_now "$SECRET" || true)"

# 7) TOTP verify/enable
expect_http "TOTP verify/enable" 200 \
  -X POST "$BASE/v1/auth/mfa/totp/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"factorId\":\"$FACTOR\",\"code\":\"$CODE\"}" || true
cp "$TMP/out.json" "$TMP/mfa-enable.json"
RECOVERY="$(python3 - <<PY
import json
print(json.load(open('$TMP/mfa-enable.json')).get('recoveryCodes',[''])[0])
PY
)"

# 8) Logout current session (MFA now enabled for next login)
expect_http "Logout" 200 \
  -X POST "$BASE/v1/auth/logout" \
  -H "Authorization: Bearer $TOKEN" || true

# 9) Login with MFA required
expect_http "Login MFA required" 200 \
  -X POST "$BASE/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: ${DEVICE}-mfa" \
  -d '{"email":"demo@daladrop.test","password":"TestPass123!@#"}' || true
cp "$TMP/out.json" "$TMP/mfa-login.json"
CHALLENGE="$(json_get "$TMP/mfa-login.json" mfaChallengeId || true)"
MFA_CODE="$(totp_now "$SECRET" || true)"

# 10) Verify MFA login
expect_http "Verify MFA login" 200 \
  -X POST "$BASE/v1/auth/mfa/verify-login" \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: ${DEVICE}-mfa" \
  -d "{\"mfaChallengeId\":\"$CHALLENGE\",\"code\":\"$MFA_CODE\"}" || true
cp "$TMP/out.json" "$TMP/mfa-session.json"
TOKEN="$(json_get "$TMP/mfa-session.json" token || true)"

# 11) Disable MFA with TOTP
DISABLE_CODE="$(totp_now "$SECRET" || true)"
expect_http "Disable MFA" 200 \
  -X POST "$BASE/v1/auth/mfa/disable" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$DISABLE_CODE\"}" || true

# 12) Signup OTP request
SIGNUP_EMAIL="signup-$(date +%s)@daladrop.test"
expect_http "Request signup OTP" 200 \
  -X POST "$BASE/v1/auth/request-signup-otp" \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: ${DEVICE}-signup" \
  -d "{\"identifier\":\"$SIGNUP_EMAIL\"}" || true

# Force known OTP so CLI can verify without SMTP
force_otp "$SIGNUP_EMAIL" "SIGNUP" "123456" || true

# 13) Verify signup OTP
expect_http "Verify signup OTP" 200 \
  -X POST "$BASE/v1/auth/verify-signup-otp" \
  -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$SIGNUP_EMAIL\",\"otp\":\"123456\"}" || true
cp "$TMP/out.json" "$TMP/signup-verify.json"
SIGNUP_TOKEN="$(json_get "$TMP/signup-verify.json" signupToken || true)"

# 14) Register
expect_http "Register" 200 \
  -X POST "$BASE/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: ${DEVICE}-signup" \
  -d "{
    \"firstName\":\"New\",
    \"lastName\":\"User\",
    \"surname\":\"User\",
    \"email\":\"$SIGNUP_EMAIL\",
    \"phone\":\"0798765432\",
    \"password\":\"NewUserPass1!@#\",
    \"confirmPassword\":\"NewUserPass1!@#\",
    \"signupToken\":\"$SIGNUP_TOKEN\",
    \"legalAcceptance\":{
      \"termsVersion\":\"customer-terms-2026-05-25\",
      \"privacyVersion\":\"customer-privacy-2026-05-25\",
      \"signatureName\":\"New User\"
    }
  }" || true
cp "$TMP/out.json" "$TMP/register.json"
NEW_TOKEN="$(json_get "$TMP/register.json" token || true)"

# 15) Forgot password
expect_http "Forgot password" 200 \
  -X POST "$BASE/v1/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: ${DEVICE}-reset" \
  -d "{\"identifier\":\"$SIGNUP_EMAIL\"}" || true

force_otp "$SIGNUP_EMAIL" "RESET_PASSWORD" "654321" || true

# 16) Verify reset OTP
expect_http "Verify reset OTP" 200 \
  -X POST "$BASE/v1/auth/verify-reset-otp" \
  -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$SIGNUP_EMAIL\",\"otp\":\"654321\"}" || true

# 17) Reset password confirmed
expect_http "Reset password confirmed" 200 \
  -X POST "$BASE/v1/auth/reset-password-confirmed" \
  -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$SIGNUP_EMAIL\",\"otp\":\"654321\",\"newPassword\":\"ResetPass123!@#\"}" || true

# 18) Login with new password
expect_http "Login after reset" 200 \
  -X POST "$BASE/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: ${DEVICE}-after-reset" \
  -d "{\"email\":\"$SIGNUP_EMAIL\",\"password\":\"ResetPass123!@#\"}" || true

# 19) Social (expected not configured)
expect_http "Google social (expected 501)" 501 \
  -X POST "$BASE/v1/auth/google" \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: ${DEVICE}-social" \
  -d '{"idToken":"dummy-token-not-verified","role":"CUSTOMER"}' || true

expect_http "Apple social (expected 501)" 501 \
  -X POST "$BASE/v1/auth/apple" \
  -H 'Content-Type: application/json' \
  -H "X-Device-Id: ${DEVICE}-social" \
  -d '{"identityToken":"dummy-token-not-verified","role":"CUSTOMER"}' || true

echo
echo "=============================="
echo "Passed: $pass"
echo "Failed: $fail"
echo "Signup email used: $SIGNUP_EMAIL"
echo "Demo user still: demo@daladrop.test / TestPass123!@# (MFA disabled again if disable succeeded)"
echo "=============================="
[[ "$fail" -eq 0 ]]
