#!/usr/bin/env sh
# Scan tracked files for accidental secrets (CI / pre-commit).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERNS='DATABASE_URL=postgres|SESSION_SECRET=[a-zA-Z0-9]{20,}|sk_live_|sk_test_|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC )?PRIVATE KEY-----'

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  FILES="$(git ls-files)"
else
  FILES="$(find . -type f ! -path './.git/*' ! -path './.deploy-venv/*' ! -path './web/.next/*' ! -path './node_modules/*')"
fi

FOUND=0
for pattern in $PATTERNS; do
  if echo "$FILES" | xargs grep -lE "$pattern" 2>/dev/null | grep -qvE '\.(md|example|sample)$'; then
    echo "Possible secret ($pattern):"
    echo "$FILES" | xargs grep -lE "$pattern" 2>/dev/null || true
    FOUND=1
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo "Secret scan failed."
  exit 1
fi
echo "Secret scan OK."
