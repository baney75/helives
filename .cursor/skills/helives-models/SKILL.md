---
name: helives-models
description: >
  He Lives 3D model pipeline: Blender/glTF budgets, original assets, Grok Imagine
  stills as loop targets not meshes. Use when modeling garden, fall, creatures,
  later-book scenes, or comparing canvas screenshots to docs/targets.
---

# He Lives Models

Harness: `~/.cursor/skills/blender-3d` (Blender MCP) and **`three-js` → GLTF asset pipeline** (gltf-transform, Draco, webp textures). Assets legality: `~/.cursor/skills/assets`. Imagine craft: `~/.grok/bundled/skills/imagine/SKILL.md`.

Grok stills are **reference frames**. They are not imported as the mesh.

## Path (required, runnable)

1. **Blockout** in R3F (`src/scene/visuals/<Scene>.tsx`) or Blender cubes. Lock scale to the camera at that beat (`/genesis?pause=1&progress=`).
2. **Target still** via Grok Imagine. There is **no** `grok imagine` binary (`which grok` is the Grok Build TUI).
   - In Grok Build: `/imagine <prompt>` or tools `image_gen` / `image_edit`.
   - Prompt from `DESIGN.md` tokens + the KJV scene in `src/genesis/kjv.ts`. Not “epic fantasy concept art.”
   - Save: `pnpm targets <input.jpg> <book>/<scene>`
   - Write the one-line prompt to `docs/targets/<book>/<scene>.prompt.txt`.
3. **Model.** Original work only. Two legal ship paths:
   - **Authored R3F** in `src/scene/visuals/` + `src/scene/models/` (use this when Blender MCP is missing; `which blender` may still exist for a local `--background` script).
   - **Blender GLB:** apply transforms, triangulate if needed, export GLB (not FBX) to `public/models/<book>/<scene>.glb`.
4. **Compress GLB** if used: `npx gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp`
5. **Load GLB** with drei `useGLTF` + Suspense. Dispose on unmount. Do **not** paste the still onto a plane as the garden/fall hero.
6. **Screenshot** the live canvas at the same beat:
   ```bash
   pnpm build && pnpm capture --out <dir>
   ```
   Beats: beginning `0.02`, garden `0.65`, fall `0.745`.
7. **Compare** still vs screenshot (`helives-gauntlet`). An independent critic judges. Do not “fix” the still to match a lazy mesh.

Garden/Fall silhouette contract lives in `src/scene/models/eden.ts`. Change the layout there first so tests and both scenes stay aligned.

## Budgets

| Limit | Target |
|-------|--------|
| Tris per hero asset | &lt; 100K |
| File size | &lt; 5 MB ideal after Draco/webp |
| Textures | Power-of-two; webp/KTX2 |
| Draw calls | Instance repeated grove trees, birds, fish |
| Mobile | Keep heroes; cut grove/creature instance counts via `BUDGET` |

Place shipping GLBs in `public/models/<book>/`. Working `.blend` files stay out of git unless small and needed; prefer `~/Documents/Audiovisual/3D/` for WIP.

## Grok Imagine (actual commands)

There is **no** `grok imagine` or `imagegen` binary on this Mac.

```text
which grok
# /Users/baney/.grok/bin/grok   → Grok Build TUI
```

Inside Grok Build:

- Slash: `/imagine <description>`
- Agent tools: `image_gen` (new still), `image_edit` (iterate from the last still)

Then compress with the real local encoder:

```bash
pnpm targets /path/to/imagine.jpg genesis/garden
# writes docs/targets/genesis/garden.webp via cwebp
```

Prompt with He Lives tokens (void `#07060a`, fire `#e8b86d`, dawn `#fff4d6`), 16:9 for cinematic frames, 1:1 for hero assets. Reverent. No photoreal Jesus for clickbait. No named living persons.

## Scene priorities (Genesis)

| Scene | Must read as | Forbidden shipping look |
|-------|----------------|-------------------------|
| Garden | Planted garden, river, tree of life, tree of knowledge, two figures | Disk of icosahedron canopies + capsule people |
| Fall | Serpent, fruit taken and eaten, sending-forth | Lone tube-curve + red orb |
| Living creatures | Fish and fowl silhouettes | Sphere-fish / cone-bird as the hero shape |
| Void / light / stars | Named day, night/gold grammar | Generic nebula blob as the whole scene |

Void/light/stars may stay points/instances once the named read is there.

## Verify

- [ ] Target still exists under `docs/targets/<book>/` with a prompt note
- [ ] Garden/Fall still encode the KJV set in `eden.ts` (tests cover the layout)
- [ ] Low/medium/high still run (`BUDGET` / `?quality=`)
- [ ] Screenshot compared **by an independent critic** (`helives-gauntlet`), not the modeler
- [ ] License/originality noted
- [ ] No secrets, no paid-pack dumps, no still-as-mesh
