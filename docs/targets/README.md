# Visual targets

Grok Imagine (and Cursor image tools) produce **reference stills** for the gauntlet. They are not 3D meshes and not the site favicon/og unless redesigned on purpose.

## Layout

```
docs/targets/<book>/<scene-id>.webp
docs/targets/<book>/<scene-id>.prompt.txt   # optional: exact prompt used
```

Example: `docs/targets/genesis/garden.webp` for the Eden blockout → sculpt loop.

Prefer compressed webp under ~400 KB. Git LFS only if a still must stay huge; compress first.

## How to generate (this Mac)

`which grok` → `/Users/baney/.grok/bin/grok` (Grok Build TUI). There is no `grok imagine` or `imagegen` CLI subcommand.

In Grok Build:

- `/imagine night field #07060a, gold #e8b86d, Latin cross of light, garden eastward, reverent, not cartoon`
- or agent tools `image_gen` / `image_edit` (`~/.grok/bundled/skills/imagine/SKILL.md`)

Copy the output into this folder as webp. Record the prompt.

## Compare

See `.cursor/skills/helives-gauntlet` and `.cursor/skills/helives-models`. The implementer captures the canvas shot. An **independent critic** (not the same agent) judges silhouette, light, palette, reverence against the still. The implementer may not self-approve the comparison.
