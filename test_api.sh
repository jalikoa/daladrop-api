#!/bin/bash
################################################################################
# NFC Payment API — Full Endpoint Test Script
# Base URL: http://localhost:3000
# 
# Usage: 
#   bash test_api.sh                    # Run all tests sequentially
#   bash test_api.sh --section auth     # Run only a specific section
#   bash test_api.sh --dry-run          # Print commands without executing
#   bash test_api.sh --user merchant    # Test with merchant credentials only
#
# Credentials (pre-configured from your DB):
#   Admin:    admin@nfcapi.com / Pass@123
#   Alice:    alice@example.com / secret@123 (CUSTOMER role, PENDING merchant)
#   Merchant: merchant@testshop.com / Pass@123 (MERCHANT role, ACTIVE+VERIFIED)
#
# [**] Known Route Bugs (will fail until fixed in controller):
#   - GET /merchants/me  [**] shadowed by /:id (move @Get('me') above @Get(':id'))
#   - GET /nfc/decode    [**] shadowed by /:id (move @Get('decode') above @Get(':id'))
################################################################################

set -e

# [**] CONFIGURATION
BASE_URL="http://localhost:3000"

# [**] Pre-generated Authentication Tokens (update when expired)
# Admin token (user_id=1, role=ADMIN)
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkBuZmNhcGkuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzczNTc5OTI2LCJleHAiOjE3NzM2NjYzMjZ9.yKnKuIMTcVsAx540EPUfmpogcFa_oRjUVHW_xEHS1NQ"

# Alice token (user_id=2, role=CUSTOMER, merchant_id=1 PENDING)
ALICE_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwiZW1haWwiOiJhbGljZUBleGFtcGxlLmNvbSIsInJvbGUiOiJDVVNUT01FUiIsImlhdCI6MTc3MzU3OTk3NCwiZXhwIjoxNzczNjY2Mzc0fQ.taXmWY3qsN9_pIPLWUevkL0C53DaWEVCZZl6J7A9yag"

# Merchant token (user_id=3, role=MERCHANT, merchant_id=2 ACTIVE+VERIFIED)
MERCHANT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwiZW1haWwiOiJtZXJjaGFudEB0ZXN0c2hvcC5jb20iLCJyb2xlIjoiTUVSQ0hBTlQiLCJpYXQiOjE3NzM1ODE0NDgsImV4cCI6MTc3MzY2Nzg0OH0.LvzifNY3PPrnZQHcLIUv5AzdqXX9ZVIo-_tecqHh5g8"

# [**] User and Merchant IDs from Database
ADMIN_USER_ID=1
ALICE_USER_ID=2
ALICE_MERCHANT_ID=1
MERCHANT_USER_ID=3
MERCHANT_PROFILE_ID=2

# [**] Webhook Configuration
WEBHOOK_SECRET="${WEBHOOK_SECRET:-your-webhook-secret-here}"

# [**] Runtime Flags
DRY_RUN=false
SECTION_FILTER=""
USER_MODE="all"

# [**] Parse Command Line Arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --section)
      SECTION_FILTER="$2"
      shift 2
      ;;
    --user)
      USER_MODE="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --dry-run              Print commands without executing"
      echo "  --section <name>       Run only specified section"
      echo "  --user <role>          Test with: admin, alice, merchant, or all"
      echo "  --help                 Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# [**] Helper Functions
print_header() {
  echo ""
  echo "################################################################################"
  echo "# [**] $1"
  echo "################################################################################"
}

print_subheader() {
  echo ""
  echo "## [**] $1"
}

print_info() {
  echo "[**] $1"
}

print_error() {
  echo "[**] ERROR: $1" >&2
}

run_curl() {
  local description="$1"
  local cmd="$2"
  
  echo ""
  echo "[**] TEST: $description"
  echo "     Command: $cmd"
  
  if [ "$DRY_RUN" = true ]; then
    echo "     [**] DRY RUN: Command would execute above"
    return 0
  fi
  
  local response
  response=$(eval "$cmd" 2>&1) || true
  
  if echo "$response" | python3 -m json.tool > /dev/null 2>&1; then
    echo "$response" | python3 -m json.tool
  else
    echo "$response"
  fi
  
  sleep 0.2
}

# [**] Test Sections
test_root() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "root" ]] && return
  [[ "$USER_MODE" != "all" && "$USER_MODE" != "admin" ]] && return
  
  print_header "ROOT ENDPOINTS"
  run_curl "Health check - root endpoint" \
    "curl -sS $BASE_URL/"
}

test_public() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "public" ]] && return
  
  print_header "PUBLIC ENDPOINTS (No Authentication Required)"
  
  run_curl "Public NFC payment entry point" \
    "curl -sS \"$BASE_URL/pay?token=<ENCRYPTED_TOKEN>\""
  
  run_curl "Payment session polling by UUID" \
    "curl -sS $BASE_URL/payments/session/a3f8c4d2-1234-5678-abcd-ef0123456789"
  
  run_curl "Initiate M-Pesa STK push (public endpoint)" \
    "curl -sS -X POST $BASE_URL/payments/stk \
      -H 'Content-Type: application/json' \
      -d '{\"merchant_id\":'$MERCHANT_PROFILE_ID',\"customer_phone\":\"+254712345678\",\"amount\":500.00,\"description\":\"Test payment\"}'"
}

test_auth() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "auth" ]] && return
  
  print_header "AUTHENTICATION ENDPOINTS"
  
  print_subheader "Login Tests"
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "admin" ]]; then
    run_curl "POST /auth/login - Admin credentials" \
      "curl -sS -X POST $BASE_URL/auth/login \
        -H 'Content-Type: application/json' \
        -d '{\"email\":\"admin@nfcapi.com\",\"password\":\"Pass@123\"}'"
  fi
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "alice" ]]; then
    run_curl "POST /auth/login - Alice (Customer) credentials" \
      "curl -sS -X POST $BASE_URL/auth/login \
        -H 'Content-Type: application/json' \
        -d '{\"email\":\"alice@example.com\",\"password\":\"secret@123\"}'"
  fi
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "merchant" ]]; then
    run_curl "POST /auth/login - Merchant credentials" \
      "curl -sS -X POST $BASE_URL/auth/login \
        -H 'Content-Type: application/json' \
        -d '{\"email\":\"merchant@testshop.com\",\"password\":\"Pass@123\"}'"
  fi
  
  print_subheader "Token Refresh"
  run_curl "POST /auth/refresh - Refresh token flow" \
    "curl -sS -X POST $BASE_URL/auth/refresh \
      -H 'Content-Type: application/json' \
      -d '{\"refresh_token\":\"<REFRESH_TOKEN>\"}'"
}

test_health() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "health" ]] && return
  
  print_header "HEALTH AND MONITORING ENDPOINTS"
  
  run_curl "GET /health - Full health check (DB, Redis, System)" \
    "curl -sS $BASE_URL/health"
  
  run_curl "GET /health/ready - Kubernetes readiness probe" \
    "curl -sS $BASE_URL/health/ready"
  
  run_curl "GET /health/version - Application version info" \
    "curl -sS $BASE_URL/health/version"
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "admin" ]]; then
    run_curl "GET /health/metrics - System metrics (Admin only)" \
      "curl -sS $BASE_URL/health/metrics \
        -H \"Authorization: Bearer $ADMIN_TOKEN\""
  fi
}

test_audit() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "audit" ]] && return
  [[ "$USER_MODE" != "all" && "$USER_MODE" != "admin" ]] && return
  
  print_header "AUDIT LOGS ENDPOINTS (Admin Only)"
  
  run_curl "GET /audit/logs - Paginated audit log list" \
    "curl -sS \"$BASE_URL/audit/logs?page=1&limit=20\" \
      -H \"Authorization: Bearer $ADMIN_TOKEN\""
  
  run_curl "GET /audit/logs - Filter by user_id and action" \
    "curl -sS \"$BASE_URL/audit/logs?user_id=2&action=LOGIN\" \
      -H \"Authorization: Bearer $ADMIN_TOKEN\""
}

test_users() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "users" ]] && return
  
  print_header "USER MANAGEMENT ENDPOINTS"
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "admin" ]]; then
    print_subheader "Admin User Operations"
    
    run_curl "GET /users - List all users (Admin)" \
      "curl -sS \"$BASE_URL/users?page=1&limit=10\" \
        -H \"Authorization: Bearer $ADMIN_TOKEN\""
    
    run_curl "GET /users/:id - Fetch user by numeric ID (Admin)" \
      "curl -sS $BASE_URL/users/$ALICE_USER_ID \
        -H \"Authorization: Bearer $ADMIN_TOKEN\""
    
    run_curl "GET /users/uuid/:uuid - Fetch user by UUID (Admin)" \
      "curl -sS $BASE_URL/users/uuid/e09e307f-7600-4dd1-b530-44696dd62d89 \
        -H \"Authorization: Bearer $ADMIN_TOKEN\""
    
    run_curl "PATCH /users/:id - Update user details (Admin)" \
      "curl -sS -X PATCH $BASE_URL/users/$ALICE_USER_ID \
        -H \"Authorization: Bearer $ADMIN_TOKEN\" \
        -H 'Content-Type: application/json' \
        -d '{\"phone_number\":\"+254799000001\"}'"
  fi
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "alice" ]]; then
    print_subheader "Self-Service User Operations (Alice)"
    
    run_curl "GET /users/:id - Alice fetching own record" \
      "curl -sS $BASE_URL/users/$ALICE_USER_ID \
        -H \"Authorization: Bearer $ALICE_TOKEN\""
    
    run_curl "GET /users/uuid/:uuid - Alice fetching by UUID" \
      "curl -sS $BASE_URL/users/uuid/e09e307f-7600-4dd1-b530-44696dd62d89 \
        -H \"Authorization: Bearer $ALICE_TOKEN\""
    
    run_curl "PATCH /users/:id - Alice updating own phone number" \
      "curl -sS -X PATCH $BASE_URL/users/$ALICE_USER_ID \
        -H \"Authorization: Bearer $ALICE_TOKEN\" \
        -H 'Content-Type: application/json' \
        -d '{\"phone_number\":\"+254799000001\"}'"
  fi
}

test_merchants() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "merchants" ]] && return
  
  print_header "MERCHANT PROFILE ENDPOINTS"
  print_info "Note: GET /merchants/me may fail if route order bug exists in controller"
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "admin" ]]; then
    print_subheader "Admin Merchant Operations"
    
    run_curl "GET /merchants - List all merchants (Admin)" \
      "curl -sS \"$BASE_URL/merchants?page=1&limit=10&status=ACTIVE\" \
        -H \"Authorization: Bearer $ADMIN_TOKEN\""
    
    run_curl "GET /merchants/:id - Fetch merchant by ID (Admin)" \
      "curl -sS $BASE_URL/merchants/$ALICE_MERCHANT_ID \
        -H \"Authorization: Bearer $ADMIN_TOKEN\""
    
    run_curl "PATCH /merchants/:id - Update merchant (Admin)" \
      "curl -sS -X PATCH $BASE_URL/merchants/$ALICE_MERCHANT_ID \
        -H \"Authorization: Bearer $ADMIN_TOKEN\" \
        -H 'Content-Type: application/json' \
        -d '{\"business_email\":\"admin-updated@example.com\"}'"
  fi
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "alice" ]]; then
    print_subheader "Alice (Customer with PENDING merchant) Operations"
    
    run_curl "GET /merchants/:id - Alice accessing her merchant profile" \
      "curl -sS $BASE_URL/merchants/$ALICE_MERCHANT_ID \
        -H \"Authorization: Bearer $ALICE_TOKEN\""
    
    run_curl "GET /merchants/me - Alice accessing own merchant via /me" \
      "curl -sS $BASE_URL/merchants/me \
        -H \"Authorization: Bearer $ALICE_TOKEN\""
    
    run_curl "GET /merchants/:id/payment-link - Generate payment link (expects 422 for PENDING merchant)" \
      "curl -sS \"$BASE_URL/merchants/$ALICE_MERCHANT_ID/payment-link?qr=true\" \
        -H \"Authorization: Bearer $ALICE_TOKEN\""
  fi
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "merchant" ]]; then
    print_subheader "Merchant (ACTIVE+VERIFIED) Operations"
    
    run_curl "GET /merchants/me - Merchant fetching own profile" \
      "curl -sS $BASE_URL/merchants/me \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
    
    run_curl "GET /merchants/:id - Merchant accessing own profile by ID" \
      "curl -sS $BASE_URL/merchants/$MERCHANT_PROFILE_ID \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
    
    run_curl "PATCH /merchants/:id - Merchant updating own details" \
      "curl -sS -X PATCH $BASE_URL/merchants/$MERCHANT_PROFILE_ID \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\" \
        -H 'Content-Type: application/json' \
        -d '{\"business_email\":\"merchant-updated@testshop.co.ke\",\"business_phone\":\"+254722000002\"}'"
    
    run_curl "GET /merchants/:id/payment-link - Generate encrypted payment URL + QR (should succeed for ACTIVE+VERIFIED)" \
      "curl -sS \"$BASE_URL/merchants/$MERCHANT_PROFILE_ID/payment-link?qr=true\" \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
    
    run_curl "GET /merchants/:id/cards - List NFC cards for merchant (stub endpoint)" \
      "curl -sS $BASE_URL/merchants/$MERCHANT_PROFILE_ID/cards \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
  fi
}

test_nfc() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "nfc" ]] && return
  
  print_header "NFC TAG MANAGEMENT ENDPOINTS"
  print_info "Note: GET /nfc/decode may fail if route order bug exists in controller"
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "admin" ]]; then
    print_subheader "Admin NFC Operations"
    
    run_curl "POST /nfc - Admin provisioning NFC tag for merchant" \
      "curl -sS -X POST \"$BASE_URL/nfc?merchant_id=$MERCHANT_PROFILE_ID\" \
        -H \"Authorization: Bearer $ADMIN_TOKEN\" \
        -H 'Content-Type: application/json' \
        -d '{\"tag_uid\":\"04:AA:BB:CC:DD:EE\",\"description\":\"Admin provisioned tag\"}'"
    
    run_curl "GET /nfc - Admin listing NFC tags for merchant" \
      "curl -sS \"$BASE_URL/nfc?merchant_id=$MERCHANT_PROFILE_ID&page=1&limit=10\" \
        -H \"Authorization: Bearer $ADMIN_TOKEN\""
    
    run_curl "GET /nfc/:id - Admin fetching specific NFC tag" \
      "curl -sS $BASE_URL/nfc/1 \
        -H \"Authorization: Bearer $ADMIN_TOKEN\""
  fi
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "alice" ]]; then
    print_subheader "Alice NFC Operations (expects restrictions due to PENDING status)"
    
    run_curl "POST /nfc - Alice creating NFC tag (expects 422 for PENDING merchant)" \
      "curl -sS -X POST \"$BASE_URL/nfc?merchant_id=$ALICE_MERCHANT_ID\" \
        -H \"Authorization: Bearer $ALICE_TOKEN\" \
        -H 'Content-Type: application/json' \
        -d '{\"tag_uid\":\"04:AB:CD:EF:12:34\",\"description\":\"Alice test tag\"}'"
    
    run_curl "GET /nfc - Alice listing NFC tags (may fail due to guard logic)" \
      "curl -sS \"$BASE_URL/nfc?merchant_id=$ALICE_MERCHANT_ID&page=1&limit=10\" \
        -H \"Authorization: Bearer $ALICE_TOKEN\""
  fi
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "merchant" ]]; then
    print_subheader "Merchant NFC Operations (ACTIVE+VERIFIED)"
    
    run_curl "POST /nfc - Merchant provisioning new NFC tag (should succeed)" \
      "curl -sS -X POST \"$BASE_URL/nfc?merchant_id=$MERCHANT_PROFILE_ID\" \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\" \
        -H 'Content-Type: application/json' \
        -d '{\"tag_uid\":\"04:FF:EE:DD:CC:BB\",\"description\":\"Main counter tag\"}'"
    
    run_curl "GET /nfc - Merchant listing own NFC tags" \
      "curl -sS \"$BASE_URL/nfc?merchant_id=$MERCHANT_PROFILE_ID&page=1&limit=10\" \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
    
    run_curl "GET /nfc/:id - Merchant fetching own NFC tag" \
      "curl -sS $BASE_URL/nfc/1 \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
  fi
  
  print_subheader "Public NFC Token Decoding"
  run_curl "GET /nfc/decode - Decrypt NFC/QR token (public endpoint)" \
    "curl -sS \"$BASE_URL/nfc/decode?token=<ENCRYPTED_TOKEN>\""
}

test_payments() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "payments" ]] && return
  
  print_header "PAYMENT PROCESSING ENDPOINTS"
  
  print_subheader "Public Payment Initiation"
  run_curl "POST /payments/stk - Initiate M-Pesa STK push (public)" \
    "curl -sS -X POST $BASE_URL/payments/stk \
      -H 'Content-Type: application/json' \
      -d '{\"merchant_id\":'$MERCHANT_PROFILE_ID',\"customer_phone\":\"+254712345678\",\"amount\":500.00,\"description\":\"Test payment from script\"}'"
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "admin" ]]; then
    print_subheader "Admin Payment Operations"
    
    run_curl "GET /payments - Admin listing all payments" \
      "curl -sS \"$BASE_URL/payments?page=1&limit=10\" \
        -H \"Authorization: Bearer $ADMIN_TOKEN\""
    
    run_curl "GET /payments/:id - Admin fetching payment by ID" \
      "curl -sS $BASE_URL/payments/1 \
        -H \"Authorization: Bearer $ADMIN_TOKEN\""
  fi
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "alice" ]]; then
    print_subheader "Alice Payment Operations (Customer with PENDING merchant)"
    
    run_curl "GET /payments - Alice listing payments (expects 403 or empty)" \
      "curl -sS \"$BASE_URL/payments?merchant_id=$ALICE_MERCHANT_ID&page=1&limit=10\" \
        -H \"Authorization: Bearer $ALICE_TOKEN\""
    
    run_curl "GET /payments/:id - Alice fetching payment (expects 403 if not owner)" \
      "curl -sS $BASE_URL/payments/1 \
        -H \"Authorization: Bearer $ALICE_TOKEN\""
    
    run_curl "GET /payments/merchant/:id - Alice fetching by merchant path param" \
      "curl -sS \"$BASE_URL/payments/merchant/$ALICE_MERCHANT_ID?page=1&limit=10\" \
        -H \"Authorization: Bearer $ALICE_TOKEN\""
    
    run_curl "GET /payments/merchant/:id/statistics - Alice payment analytics" \
      "curl -sS \"$BASE_URL/payments/merchant/$ALICE_MERCHANT_ID/statistics?from=2026-01-01&to=2026-03-15\" \
        -H \"Authorization: Bearer $ALICE_TOKEN\""
  fi
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "merchant" ]]; then
    print_subheader "Merchant Payment Operations (ACTIVE+VERIFIED)"
    
    run_curl "GET /payments - Merchant listing own payments" \
      "curl -sS \"$BASE_URL/payments?merchant_id=$MERCHANT_PROFILE_ID&page=1&limit=10\" \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
    
    run_curl "GET /payments/:id - Merchant fetching own payment" \
      "curl -sS $BASE_URL/payments/1 \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
    
    run_curl "GET /payments/merchant/:id - Merchant payments by path param" \
      "curl -sS \"$BASE_URL/payments/merchant/$MERCHANT_PROFILE_ID?page=1&limit=10\" \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
    
    run_curl "GET /payments/merchant/:id/statistics - Merchant payment analytics" \
      "curl -sS \"$BASE_URL/payments/merchant/$MERCHANT_PROFILE_ID/statistics?from=2026-01-01&to=2026-03-15\" \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
  fi
}

test_notifications() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "notifications" ]] && return
  [[ "$USER_MODE" != "all" && "$USER_MODE" != "admin" ]] && return
  
  print_header "NOTIFICATION ENDPOINTS (Admin Only)"
  
  run_curl "POST /notifications/sms - Send SMS notification" \
    "curl -sS -X POST $BASE_URL/notifications/sms \
      -H \"Authorization: Bearer $ADMIN_TOKEN\" \
      -H 'Content-Type: application/json' \
      -d '{\"phone\":\"+254712345678\",\"message\":\"Your payment of KES 500 was received.\"}'"
  
  run_curl "POST /notifications/email - Send email notification" \
    "curl -sS -X POST $BASE_URL/notifications/email \
      -H \"Authorization: Bearer $ADMIN_TOKEN\" \
      -H 'Content-Type: application/json' \
      -d '{\"email\":\"alice@example.com\",\"subject\":\"Payment Received\",\"body\":\"<p>Your payment was received.</p>\"}'"
  
  run_curl "POST /notifications/push - Send push notification" \
    "curl -sS -X POST $BASE_URL/notifications/push \
      -H \"Authorization: Bearer $ADMIN_TOKEN\" \
      -H 'Content-Type: application/json' \
      -d '{\"token\":\"<DEVICE_FCM_TOKEN>\",\"title\":\"Payment Confirmed\",\"body\":\"KES 500 received\"}'"
}

test_qr() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "qr" ]] && return
  
  print_header "QR CODE ENDPOINTS"
  print_info "Note: These endpoints may return 404 if not yet implemented"
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "admin" ]]; then
    run_curl "POST /qr/generate - Generate QR for arbitrary data (Admin)" \
      "curl -sS -X POST $BASE_URL/qr/generate \
        -H \"Authorization: Bearer $ADMIN_TOKEN\" \
        -H 'Content-Type: application/json' \
        -d '{\"data\":\"https://pay.example.com/pay?token=abc123\",\"size\":300,\"errorCorrection\":\"H\"}'"
  fi
  
  if [[ "$USER_MODE" == "all" || "$USER_MODE" == "merchant" ]]; then
    run_curl "GET /qr/merchant/:id - Generate QR for merchant payment URL" \
      "curl -sS \"$BASE_URL/qr/merchant/$MERCHANT_PROFILE_ID?size=300\" \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
    
    run_curl "GET /qr/download/:id - Download QR as PNG binary" \
      "curl -sS -OJ \"$BASE_URL/qr/download/$MERCHANT_PROFILE_ID\" \
        -H \"Authorization: Bearer $MERCHANT_TOKEN\""
  fi
}

test_pdf() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "pdf" ]] && return
  
  print_header "PDF AND MERCHANT CARD ENDPOINTS"
  
  local test_merchant_id="$ALICE_MERCHANT_ID"
  local test_token="$ALICE_TOKEN"
  
  if [[ "$USER_MODE" == "merchant" ]]; then
    test_merchant_id="$MERCHANT_PROFILE_ID"
    test_token="$MERCHANT_TOKEN"
  elif [[ "$USER_MODE" == "admin" ]]; then
    test_token="$ADMIN_TOKEN"
  fi
  
  run_curl "GET /pdf/merchant/:id/card - Download merchant card PDF" \
    "curl -sS -OJ \"$BASE_URL/pdf/merchant/$test_merchant_id/card\" \
      -H \"Authorization: Bearer $test_token\""
  
  run_curl "POST /pdf/merchant/:id/card/generate - Queue async PDF generation" \
    "curl -sS -X POST \"$BASE_URL/pdf/merchant/$test_merchant_id/card/generate?async=true\" \
      -H \"Authorization: Bearer $test_token\""
  
  run_curl "POST /pdf/merchant/:id/card/generate - Generate PDF synchronously" \
    "curl -sS -X POST \"$BASE_URL/pdf/merchant/$test_merchant_id/card/generate?async=false\" \
      -H \"Authorization: Bearer $test_token\""
  
  run_curl "GET /pdf/download/:fileName - Download previously generated PDF" \
    "curl -sS -OJ \"$BASE_URL/pdf/download/merchant_${test_merchant_id}_card.pdf\" \
      -H \"Authorization: Bearer $test_token\""
}

test_webhooks() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "webhooks" ]] && return
  
  print_header "WEBHOOK ENDPOINTS"
  print_info "Security Note: GET /webhooks/logs currently has no auth guard"
  
  print_subheader "Webhook Callback Simulation"
  
  run_curl "POST /webhooks/daraja/stk - Simulate Safaricom STK callback" \
    "curl -sS -X POST $BASE_URL/webhooks/daraja/stk \
      -H 'Content-Type: application/json' \
      -H \"X-Webhook-Secret: $WEBHOOK_SECRET\" \
      -d '{
        \"Body\": {
          \"stkCallback\": {
            \"MerchantRequestID\": \"29115-34620561-1\",
            \"CheckoutRequestID\": \"ws_CO_191220191020363925\",
            \"ResultCode\": 0,
            \"ResultDesc\": \"The service request is processed successfully.\",
            \"CallbackMetadata\": {
              \"Item\": [
                {\"Name\":\"Amount\",\"Value\":500},
                {\"Name\":\"MpesaReceiptNumber\",\"Value\":\"NLJ7RT61SV\"},
                {\"Name\":\"PhoneNumber\",\"Value\":254712345678}
              ]
            }
          }
        }
      }'"
  
  run_curl "POST /webhooks/africastalking/sms - Simulate SMS delivery report" \
    "curl -sS -X POST $BASE_URL/webhooks/africastalking/sms \
      -H 'Content-Type: application/json' \
      -H \"X-Webhook-Secret: $WEBHOOK_SECRET\" \
      -d '{\"id\":\"ATXid_1234abcd\",\"status\":\"Success\",\"phoneNumber\":\"+254712345678\"}'"
  
  print_subheader "Webhook Logs (Public Read - Security Concern)"
  
  run_curl "GET /webhooks/logs - List webhook logs (no auth)" \
    "curl -sS \"$BASE_URL/webhooks/logs?page=1&limit=10&source=DARAJA\""
  
  run_curl "GET /webhooks/logs/:id - Fetch single webhook log (no auth)" \
    "curl -sS $BASE_URL/webhooks/logs/1"
}

test_missing() {
  [[ -n "$SECTION_FILTER" && "$SECTION_FILTER" != "missing" ]] && return
  
  print_header "ENDPOINTS NOT YET IMPLEMENTED"
  
  echo ""
  echo "## [**] Ledger Service (no HTTP routes exposed)"
  echo "   LedgerService.getBalance() and LedgerService.record() exist internally."
  echo "   Suggested routes to implement:"
  echo "     GET  /ledger/accounts/:id/balance   [**] Account balance lookup"
  echo "     POST /ledger/entries                 [**] Double-entry ledger recording"
  echo "     GET  /ledger/entries?transaction_ref= [**] Query by transaction reference"
  
  echo ""
  echo "## [**] Queues Service (no HTTP routes exposed)"
  echo "   Suggested routes to implement:"
  echo "     GET  /queues/jobs/:queue             [**] List jobs by queue name"
  echo "     POST /queues/jobs/:queue/:id/retry   [**] Retry failed job"
}

# [**] Main Execution
main() {
  echo "NFC Payment API Test Suite"
  echo "Base URL: $BASE_URL"
  echo "User Mode: $USER_MODE"
  echo "Admin Token: ${ADMIN_TOKEN:0:40}..."
  echo "Alice Token: ${ALICE_TOKEN:0:40}..."
  echo "Merchant Token: ${MERCHANT_TOKEN:0:40}..."
  
  if [ "$DRY_RUN" = true ]; then
    echo "[**] DRY RUN MODE - Commands will be printed but not executed"
  fi
  
  echo ""
  echo "[**] Checking server availability..."
  if ! curl -sS --connect-timeout 5 "$BASE_URL/health/ready" > /dev/null 2>&1; then
    echo "[**] WARNING: Server may not be running at $BASE_URL - continuing anyway"
  fi
  
  test_root
  test_public
  test_auth
  test_health
  test_audit
  test_users
  test_merchants
  test_nfc
  test_payments
  test_notifications
  test_qr
  test_pdf
  test_webhooks
  test_missing
  
  echo ""
  echo "Test suite completed."
  echo "[**] Tips:"
  echo "  - Use --section <name> to run only specific tests"
  echo "  - Use --user <role> to test with specific credentials: admin, alice, merchant"
  echo "  - Use --dry-run to preview commands without executing"
  echo "  - Update tokens in CONFIG section if they expire (24h lifetime)"
}

main "$@"