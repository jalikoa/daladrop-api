#!/usr/bin/env bash
# Deduplicate AUTH_OTP_* keys in .env (names only; never prints values).
set -euo pipefail
cd "$(dirname "$0")/.."
node <<'EOF'
const fs = require('fs');
const path = '.env';
const lines = fs.readFileSync(path, 'utf8').split('\n');
const seen = new Set();
const out = [];
for (const line of lines) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (m && (m[1] === 'AUTH_OTP_FORCE_SEND' || m[1] === 'AUTH_OTP_CONSOLE_LOG')) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
  }
  out.push(line);
}
fs.writeFileSync(path, out.join('\n'));
const counts = {};
for (const line of out) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
}
const dups = Object.entries(counts).filter(([, c]) => c > 1).map(([k]) => k);
console.log(JSON.stringify({ deduped: true, remainingDuplicates: dups }));
EOF
