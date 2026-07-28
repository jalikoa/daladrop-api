#!/usr/bin/env bash
# Commit REDIS_URL / rediss TLS support for Render → external Redis and push.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> git status (before)"
git status --short

echo "==> staging changes (.env is gitignored and will not be included)"
git add \
  .env.example \
  scripts/commit-and-push-redis-url-support.sh \
  src/app.module.ts \
  src/config/__tests__/configuration.spec.ts \
  src/config/__tests__/redis-connection.spec.ts \
  src/config/configuration.ts \
  src/config/env.validation.ts \
  src/config/interfaces/config.interface.ts \
  src/config/redis-connection.ts \
  src/infrastructure/redis/redis-connection.factory.ts \
  src/infrastructure/redis/redis.types.ts \
  src/modules/discovery/discovery.module.ts \
  src/modules/identity/identity.module.ts \
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
Support REDIS_URL and rediss TLS for external Redis (e.g. Render → VPS).

Parse redis:// and rediss:// into nested config, pass username/TLS through ioredis and Bull/BullMQ, and document Render vs self-hosted Redis in .env.example.
EOF
)"

echo "==> pushing to origin"
git push -u origin HEAD

echo "==> git status (after)"
git status --short
echo "Done."
