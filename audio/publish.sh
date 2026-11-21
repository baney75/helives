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
rsync -a --partial --prune-empty-dirs \
  --exclude '.*' --exclude '*.part.m4a' \
  --include '*/' --include '*.m4a' --include '*.json' --exclude '*' \
  "$HOST:$REMOTE" "$STAGE/"

python3 - "$STAGE" "$URL_PREFIX" "$HERE/manifest.json" <<'PY'
import hashlib, json, os, sys, time
stage, prefix, out = sys.argv[1], sys.argv[2].strip("/"), sys.argv[3]
items, skipped = [], []
for work in sorted(os.listdir(stage)):
    wdir = os.path.join(stage, work)
    if not os.path.isdir(wdir):
        continue
    for name in sorted(os.listdir(wdir)):
        if not name.endswith(".json"):
            continue
        meta = json.load(open(os.path.join(wdir, name), encoding="utf-8"))
        audio = os.path.join(wdir, meta["audio"])
        if not os.path.exists(audio) or os.path.getsize(audio) != meta["bytes"]:
            skipped.append(f"{work}/{meta['audio']}")      # mid-copy or re-rendering; next run picks it up
            continue
        h = hashlib.sha256()
        with open(audio, "rb") as f:
            for block in iter(lambda: f.read(1 << 20), b""):
                h.update(block)
        items.append({"work": meta["work"], "section": meta["section"], "title": meta.get("title"),
                      "url": f"{prefix}/{work}/{meta['audio']}", "timing": f"{prefix}/{work}/{name}",
                      "duration": meta["duration"], "bytes": meta["bytes"], "sha256": h.hexdigest(),
                      "flagged_chunks": meta.get("flagged_chunks", 0)})
manifest = {"schema": 1, "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "stage": "staged, not uploaded",
            "files": len(items), "hours": round(sum(i["duration"] for i in items) / 3600, 2), "items": items}
tmp = out + ".tmp"
with open(tmp, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
    f.write("\n")
os.replace(tmp, out)
print(f"staged {len(items)} files ({manifest['hours']} h) in {stage}; manifest {out}")
if skipped:
    print("incomplete, skipped:", ", ".join(skipped))
PY
