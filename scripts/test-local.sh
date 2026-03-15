#!/usr/bin/env bash
################################################################################
# scripts/test-local.sh
#
# Run all tests locally with the same settings GitHub Actions uses.
#
# Usage:
#   bash scripts/test-local.sh           # unit + coverage
#   bash scripts/test-local.sh --e2e     # unit + e2e (needs Docker)
#   bash scripts/test-local.sh --watch   # unit in watch mode
#   bash scripts/test-local.sh --module payments  # single module
#   bash scripts/test-local.sh --help
################################################################################

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}▶ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
fail() { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ── Defaults ──────────────────────────────────────────────────────────────────
RUN_E2E=false
WATCH=false
MODULE=""
COVERAGE=true

# ── Args ──────────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --e2e)    RUN_E2E=true;     shift ;;
    --watch)  WATCH=true;       shift ;;
    --no-cov) COVERAGE=false;   shift ;;
    --module) MODULE="$2";      shift 2 ;;
    --help)
      echo "Usage: bash scripts/test-local.sh [--e2e] [--watch] [--no-cov] [--module <name>]"
      echo ""
      echo "  --e2e           Also run E2E tests (requires Docker with MySQL + Redis)"
      echo "  --watch         Run unit tests in watch mode"
      echo "  --no-cov        Skip coverage report"
      echo "  --module NAME   Run tests for a single module (e.g. payments, auth, nfc)"
      exit 0
      ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

# ── Check prerequisites ───────────────────────────────────────────────────────
command -v node &>/dev/null || fail "node is not installed"
command -v npm  &>/dev/null || fail "npm is not installed"
[[ -f package.json ]]       || fail "Run from the project root (no package.json found)"

# ── Test environment variables ────────────────────────────────────────────────
export NODE_ENV=test
export PORT=3000
export DB_HOST=localhost
export DB_PORT=3306
export DB_USERNAME=nfc_user
export DB_PASSWORD=nfc_test_pass
export DB_NAME=nfc_test_db
export REDIS_HOST=localhost
export REDIS_PORT=6379
export JWT_SECRET="test-jwt-secret-32-chars-minimum!"
export JWT_EXPIRATION=1d
export NFC_SECRET_KEY="testkey1234567890123456789012AB"
export DARAJA_CONSUMER_KEY=test_key
export DARAJA_CONSUMER_SECRET=test_secret
export DARAJA_PAYBILL="123456"
export DARAJA_PASSKEY=test_passkey
export DARAJA_ENV=sandbox
export AFRICASTALKING_USERNAME=sandbox
export AFRICASTALKING_API_KEY=test_key
export FIREBASE_PROJECT_ID=test-project
export FIREBASE_CLIENT_EMAIL=test@test.iam.gserviceaccount.com
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIItest\n-----END PRIVATE KEY-----\n"
export PUBLIC_URL="http://localhost:3000"
# Leave these blank so no real ES/Logstash connections are attempted during tests
export ELASTICSEARCH_URL=""
export LOGSTASH_HOST=""
export METRICS_TOKEN=""

# ── Install deps if needed ────────────────────────────────────────────────────
if [[ ! -d node_modules ]]; then
  log "Installing dependencies..."
  npm ci
fi

# ── Single module mode ────────────────────────────────────────────────────────
if [[ -n "$MODULE" ]]; then
  log "Running tests for module: $MODULE"
  npx jest --testPathPattern="$MODULE" --forceExit --verbose
  exit 0
fi

# ── Watch mode ────────────────────────────────────────────────────────────────
if [[ "$WATCH" == "true" ]]; then
  log "Starting jest in watch mode..."
  npx jest --watch
  exit 0
fi

# ── Unit tests ────────────────────────────────────────────────────────────────
log "Running unit tests..."
echo ""

if [[ "$COVERAGE" == "true" ]]; then
  npx jest --coverage --forceExit --detectOpenHandles
  echo ""
  log "Coverage report written to ./coverage/lcov-report/index.html"

  # Print a quick summary
  if command -v python3 &>/dev/null && [[ -f coverage/coverage-summary.json ]]; then
    python3 - << 'PYEOF'
import json, sys
with open('coverage/coverage-summary.json') as f:
    data = json.load(f)
total = data.get('total', {})
print("\nCoverage Summary:")
for key in ['statements', 'branches', 'functions', 'lines']:
    pct = total.get(key, {}).get('pct', 0)
    colour = '\033[0;32m' if pct >= 70 else '\033[1;33m' if pct >= 50 else '\033[0;31m'
    print(f"  {colour}{key:<12}: {pct:.1f}%\033[0m")
PYEOF
  fi
else
  npx jest --forceExit --detectOpenHandles
fi

# ── E2E tests ─────────────────────────────────────────────────────────────────
if [[ "$RUN_E2E" == "true" ]]; then
  echo ""
  log "Checking Docker services for E2E tests..."

  command -v docker &>/dev/null || fail "Docker is not installed — needed for E2E tests"

  # Start MySQL + Redis if not running
  if ! docker compose ps mysql 2>/dev/null | grep -q "running"; then
    log "Starting MySQL and Redis containers..."
    docker compose up mysql redis -d

    log "Waiting for MySQL to be healthy..."
    for i in $(seq 1 30); do
      if docker compose exec -T mysql healthcheck.sh --connect --innodb_initialized &>/dev/null 2>&1; then
        echo "  MySQL ready."
        break
      fi
      echo "  Waiting... ($i/30)"
      sleep 2
    done

    log "Running database migrations..."
    npm run migration:run
  else
    log "MySQL and Redis already running ✓"
  fi

  echo ""
  log "Running E2E tests..."
  npx jest --config ./test/jest-e2e.json --forceExit --detectOpenHandles --verbose
fi

echo ""
log "All tests passed ✓"