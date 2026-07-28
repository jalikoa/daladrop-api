#!/usr/bin/env bash
# Commit the commit-and-push helper script itself.
set -euo pipefail

cd "$(dirname "$0")/.."

git add scripts/commit-and-push-otp-messaging.sh scripts/commit-helper-script.sh 2>/dev/null || true
git add scripts/commit-and-push-otp-messaging.sh

if git diff --cached --quiet; then
  echo "Nothing to commit."
  exit 0
fi

git commit -m "$(cat <<'EOF'
chore(scripts): add commit-and-push helper for OTP messaging work

EOF
)"

git push origin HEAD
git status --short
echo "Done."
