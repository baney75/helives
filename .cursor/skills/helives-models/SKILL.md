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

## Path (required)

1. **Blockout** in R3F primitives or Blender cubes (scale, silhouette, camera).
2. **Target still** via Grok Imagine. Save compressed webp under `docs/targets/<book>/<scene>.webp`. Prompt from `DESIGN.md` tokens and the KJV scene, not “epic fantasy concept art.”
3. **Model / sculpt / texture** in Blender. Original work. No scraped game assets. Poly Haven only with license noted in `docs/targets/` or an ASSETS note.
4. **Export GLB** (not FBX). Apply transforms. Triangulate if needed.
5. **Compress:** `npx gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp`
6. **Load** with drei `useGLTF` + Suspense. Dispose on unmount.
7. **Screenshot** the live canvas (same camera intent as the still).
8. **Compare** still vs screenshot (`helives-gauntlet`). Iterate. Do not “fix” the still to match a lazy mesh.

## Budgets

| Limit | Target |
|-------|--------|
| Tris per hero asset | &lt; 100K |
| File size | &lt; 5 MB ideal after Draco/webp |
| Textures | Power-of-two; webp/KTX2 |
| Draw calls | Instance repeated trees, birds, fish |
| Mobile | Swap to low mesh or keep instanced primitives |

Place shipping GLBs in `public/models/<book>/`. Working `.blend` files stay out of git unless small and needed; prefer `~/Documents/Audiovisual/3D/` for WIP.

## Grok Imagine (actual commands)

There is **no** `grok imagine` or `imagegen` binary on this Mac.

```text
which grok
# /Users/baney/.grok/bin/grok   → Grok Build TUI 1.0.3
```

Inside Grok Build:

- Slash: `/imagine <description>`
- Agent tools: `image_gen` (new still), `image_edit` (iterate from the last still)

Prompt with He Lives tokens (void `#07060a`, fire `#e8b86d`, dawn `#fff4d6`), 16:9 for cinematic frames, 1:1 for hero assets. Reverent. No photoreal Jesus for clickbait. No named living persons.

Cursor’s image tool may produce a still in this harness; same dest path and compression rules. Prefer webp. Git LFS only if a file is huge; compress first.

## Scene priorities (Genesis debt)

Garden trees, two figures, serpent/Fall, living creatures: raise from primitives toward authored GLB. Void/light/stars may stay points/instances.

## Verify

- [ ] GLB loads without console errors
- [ ] Low/medium/high still run
- [ ] Target still exists and screenshot is compared **by an independent critic** (`helives-gauntlet`), not the modeler
- [ ] License/originality noted
- [ ] No secrets, no paid-pack dumps
