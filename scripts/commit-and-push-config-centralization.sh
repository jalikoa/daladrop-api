#!/usr/bin/env bash
# Commit production config audit + ConfigService centralization and push to origin.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> git status (before)"
git status --short

echo "==> staging changes (.env is gitignored and will not be included)"
git add \
  .env.example \
  scripts/commit-and-push-config-centralization.sh \
  scripts/dedupe-env-otp-flags.sh \
  src/app.module.ts \
  src/config/__tests__/configuration.spec.ts \
  src/config/configuration.ts \
  src/config/env.validation.ts \
  src/config/interfaces/config.interface.ts \
  src/infrastructure/redis/redis.module.ts \
  src/modules/identity/__tests__/auth-foundation.spec.ts \
  src/modules/identity/domain/auth.config.ts \
  src/modules/identity/identity.module.ts \
  src/modules/identity/use-cases/auth.service.ts \
  src/modules/notifications/notifications.module.ts \
  src/modules/notifications/processors/auth-notification.processor.ts \
  src/modules/payments/adapters/daraja-payment.provider.ts \
  src/modules/transport/listeners/ride-workflow.orchestrator.ts

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
Harden production config: Daraja callbacks, env aliases, and nested ConfigService.

Make Daraja callback auth optional (official STK has no app token), alias legacy MPESA_*/mail keys, and centralize AUTH_*/AT SMS/rate-limit + Redis/Logstash defaults through IConfig.
EOF
)"

echo "==> pushing to origin"
git push -u origin HEAD

echo "==> git status (after)"
git status --short
echo "Done."
