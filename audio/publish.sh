#!/bin/sh
# Stage finished audiobook files from Parish1 on this Mac and write audio/manifest.json.
# Runs by hand only; uploading the staged files to Cloudflare R2 is a separate step.
#
#   audio/publish.sh                  # stage into ~/.local/share/helives-audio-staging
#   HELIVES_AUDIO_STAGE=/path audio/publish.sh
set -eu

HOST="${HELIVES_AUDIO_HOST:-parish1}"
REMOTE="${HELIVES_AUDIO_REMOTE:-/srv/magnus-data/media/helives-audio/out/}"
STAGE="${HELIVES_AUDIO_STAGE:-$HOME/.local/share/helives-audio-staging}"
URL_PREFIX="${HELIVES_AUDIO_URL_PREFIX:-audio}"
HERE="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$STAGE"
if ! ssh "$HOST" "test -d '$REMOTE'"; then
  echo "nothing rendered yet: $HOST:$REMOTE does not exist"
  exit 0
fi
# Only finished files: .m4a and their .json timing manifests; never .part files or dotfiles.
# --delete: audio withdrawn on Parish1 (a removed work or section) leaves the stage and the manifest too.
rsync -a --partial --prune-empty-dirs --delete \
  --exclude '.*' --exclude '*.part.m4a' \
  --include '*/' --include '*.m4a' --include '*.json' --exclude '*' \
  "$HOST:$REMOTE" "$STAGE/"

python3 "$HERE/manifest.py" "$STAGE" "$URL_PREFIX" "$HERE/manifest.json"
