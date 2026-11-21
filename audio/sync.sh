#!/bin/sh
# Push the renderer code and the library TOML files from this checkout to Parish1.
# The service re-reads the library before every batch; changed text re-renders only changed chunks.
#
#   audio/sync.sh              # code + library
#   audio/sync.sh --install    # also install and enable helives-audio.service (user unit)
set -eu
HOST="${HELIVES_AUDIO_HOST:-parish1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
APP=".local/share/helives-audio/app"
LIB=".local/share/helives-audio/library"

ssh "$HOST" "mkdir -p $APP $LIB /srv/magnus-data/media/helives-audio"
rsync -a --delete --exclude '__pycache__' --exclude 'manifest.json' --exclude 'staging/' "$HERE/" "$HOST:$APP/"
# Library is read-only input on Parish1: only the TOML work files (and the schema) are copied.
rsync -a --delete --prune-empty-dirs --include '*/' --include '*.toml' --include 'SCHEMA.md' --exclude '*' \
  "$ROOT/library/" "$HOST:$LIB/"

if [ "${1:-}" = "--install" ]; then
  ssh "$HOST" "loginctl show-user \"\$USER\" -p Linger"
  ssh "$HOST" "mkdir -p .config/systemd/user && cp $APP/helives-audio.service .config/systemd/user/ \
    && systemctl --user daemon-reload && systemctl --user enable --now helives-audio.service \
    && systemctl --user --no-pager status helives-audio.service | head -12"
fi
