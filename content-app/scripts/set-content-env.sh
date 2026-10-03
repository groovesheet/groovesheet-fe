#!/usr/bin/env bash
# Sets the content pipeline's secrets on the Vercel project (Production).
# Works from any directory: it moves to content-app/, which is the root of the
# content Vercel project and where .vercel/ links it. Values are read without
# echo and piped to the CLI, so none of them lands in shell history or on
# screen.
#
# The content app is its OWN Vercel project, separate from the one that builds
# the CRA site. Run `npx vercel link` inside content-app/ once, and pick that
# project, before the first use.
#
#   bash content-app/scripts/set-content-env.sh              # asks for the values
#   bash content-app/scripts/set-content-env.sh --clipboard  # DeepSeek key from the clipboard
#   bash content-app/scripts/set-content-env.sh --social     # only Zernio and Upload-Post, from .env.local
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -f .vercel/project.json ] || { echo "No .vercel/project.json in $ROOT. Run: cd $ROOT && npx vercel link"; exit 1; }

put() { # name value
  printf '%s' "$2" | npx --yes vercel env add "$1" production --force >/dev/null
  echo "  set $1"
}

# The social keys come from .env.local, where they already are.
from_local() { # name
  grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
}
for NAME in ZERNIO_API_KEY UPLOAD_POST_API_KEY; do
  VALUE="$(from_local "$NAME")"
  [ -n "$VALUE" ] || { echo "$NAME is empty in $ROOT/.env.local"; exit 1; }
  put "$NAME" "$VALUE"
done

# --social: only the two keys above. Nothing to type, nothing to copy.
if [ "${1:-}" = "--social" ]; then
  echo
  npx --yes vercel env ls production 2>/dev/null | grep -E "ZERNIO_API_KEY|UPLOAD_POST_API_KEY" || true
  echo "Done. The values take effect on the next production deploy."
  exit 0
fi

# --clipboard: no typing at all. Copy the DeepSeek key first, then run this.
if [ "${1:-}" = "--clipboard" ]; then
  DEEPSEEK="$(pbpaste | tr -d '[:space:]')"
  case "$DEEPSEEK" in
    sk-*) ;;
    *) echo "The clipboard does not hold a DeepSeek key (it should start with sk-). Copy the key, then run this again."; exit 1 ;;
  esac
  CRON=""
else
  read -r -s -p "DeepSeek API key: " DEEPSEEK; echo
  [ -n "$DEEPSEEK" ] || { echo "Empty, stopping."; exit 1; }
  read -r -s -p "Cron secret (leave blank to generate a random one): " CRON; echo
fi
put DEEPSEEK_API_KEY "$DEEPSEEK"

if [ -z "$CRON" ]; then
  CRON="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))")"
  echo "  generated a random cron secret (Vercel Cron reads it itself, you never need to type it)"
fi
put CRON_SECRET "$CRON"

echo
npx --yes vercel env ls production 2>/dev/null | grep -E "DEEPSEEK_API_KEY|CRON_SECRET|ZERNIO_API_KEY|UPLOAD_POST_API_KEY" || true
echo "Done. The values take effect on the next production deploy."
