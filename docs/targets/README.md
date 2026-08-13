# Visual targets

Grok Imagine (and Cursor image tools) produce **reference stills** for the gauntlet. They are not 3D meshes and not the site favicon/og unless redesigned on purpose. Never import a still as the garden or fall mesh.

## Layout

```
docs/targets/<book>/<scene-id>.webp
docs/targets/<book>/<scene-id>.prompt.txt
```

Live Genesis compare frames:

| Scene | Still | Prompt note |
|-------|-------|-------------|
| garden | `docs/targets/genesis/garden.webp` | `garden.prompt.txt` |
| fall | `docs/targets/genesis/fall.webp` | `fall.prompt.txt` |

Prefer compressed webp under ~400 KB. Use `pnpm targets <in> <book/scene>` (wraps `cwebp`). Git LFS only if a still must stay huge; compress first.

## How to generate (this Mac)

`which grok` → `/Users/baney/.grok/bin/grok` (Grok Build TUI). There is **no** `grok imagine` or `imagegen` CLI subcommand.

In Grok Build:

- `/imagine night field #07060a, gold #e8b86d, planted garden eastward, two distinct trees, river, two figures`
- or agent tools `image_gen` / `image_edit` (`~/.grok/bundled/skills/imagine/SKILL.md`)

Then:

```bash
pnpm targets ~/.grok/sessions/<session>/images/1.jpg genesis/garden
```

Record the prompt in the sibling `.prompt.txt`.

## Mesh path (after the still)

1. Blockout silhouette in R3F (`src/scene/visuals/`) or Blender cubes.
2. Author the mesh: crafted R3F geometry in this repo, **or** `blender --background --python scripts/…` → `public/models/<book>/*.glb`.
3. Blender MCP is optional. If it is missing, authored R3F is the ship path. Do not invent a REST mesh API.
4. Preview: `pnpm build && pnpm preview`, then `/genesis?pause=1&progress=0.65` (garden) and `0.745` (fall).
5. Capture: `pnpm capture --out <dir>` (Playwright). Implementer captures; an independent critic compares still vs shot.

## Compare

See `.cursor/skills/helives-gauntlet` and `.cursor/skills/helives-models`. Pixel-perfect match is not required. “Generic blob vs garden” is a fail. The implementer may not self-approve the comparison.
