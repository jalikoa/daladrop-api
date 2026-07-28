#!/usr/bin/env bash
# Commit current OTP/messaging/admin/seed work and push to origin.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> git status (before)"
git status --short

echo "==> staging changes (.env is gitignored and will not be included)"
git add \
  .env.example \
  admin.html \
  scripts/seed-production-dump.mjs \
  src/common/filters/http-exception.filter.ts \
  src/infrastructure/external-services/index.ts \
  src/infrastructure/external-services/sms/africastalking-sms.provider.ts \
  src/main.ts \
  src/modules/events/use-cases/admin-events.service.ts \
  src/modules/notifications/notifications.module.ts

# Safety: never stage secrets
if git diff --cached --name-only | grep -E '(^|/)\.env$|\.pem$|credentials\.json$' >/dev/null; then
  echo "ERROR: refused to commit secret-like files" >&2
  git reset HEAD
  exit 1
fi

if git diff --cached --quiet; then
  echo "Nothing staged to commit."
  exit 0
fi

echo "==> committing"
git commit -m "$(cat <<'EOF'
Wire Africa's Talking SMS and harden admin OTP/test tooling.

Add a real AT SMS provider for OTP delivery, serialize event BigInts for admin APIs, recenter seed locations for local delivery tests, and keep admin console / env example in sync.
EOF
)"

echo "==> pushing to origin"
git push -u origin HEAD

echo "==> git status (after)"
git status --short
echo "Done."
