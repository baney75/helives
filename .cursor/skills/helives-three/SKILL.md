---
name: helives-three
description: >
  He Lives overlay on harness three-js: reverent biblical R3F scenes, quality
  tiers, HUD over canvas. Use when editing Genesis Canvas, later-book 3D,
  particles, bloom, or WebGL performance on helives.dev.
---

# He Lives Three

Canonical 3D skill: **`~/.cursor/skills/three-js/SKILL.md`**. Load that first. This file is constraints, not a second engine guide. Particles: `~/.cursor/skills/particle-systems`.

## Stack (already in repo)

R3F + drei + postprocessing. Entry: `src/scene/GenesisCanvas.tsx`. Visuals: `src/scene/visuals/`. Clock: `src/scene/types.ts`. Budgets: `src/lib/budget.ts`.

## Biblical scene rules

- The scene must be readable as the text it serves (void, light, firmament, dry land, lights, creatures, garden, fall). Generic nebula / blob heroes are forbidden.
- Night is `#07060a`. Warm gold light. No cyberpunk palettes.
- Figures and sacred moments stay reverent. No joke God, no meme serpent, no cute mascot Adam.
- Quoted verse lives in the HUD, not as 3D text meshes.
- Garden/Fall today are instanced primitives (debt). Raising them means real meshes via `helives-models`, not more icosahedrons pretending to be trees.

## Layering

Canvas wrapper `.stage` is `position: fixed; inset: 0; z-index: 0`. HUD `.hud` is `z-index: 10`. Genesis canvas may receive pointer events for orbit; site pages do not sit under a blocking canvas.

`?cinematic=1`: lock camera, captions only, no orbit.

## Quality tiers

Use `BUDGET` and `DPR` in `src/lib/budget.ts`. Auto quality: `src/lib/quality.ts` / `useAutoQuality`.

| Tier | DPR | Bloom | Notes |
|------|-----|-------|-------|
| low | `[1, 1]` | off | Mobile / slow p90 |
| medium | `[1, 1.25]` | on, modest | Default mid |
| high | `[1, 2]` | on | Desktop |

Do not raise particle counts without measuring. InstancedMesh for repeated objects (`src/lib/instances.ts`). Dispose manual geometries (see `TheFall.tsx`).

## R3F

- `useFrame` for motion. No new `requestAnimationFrame` loops in React components.
- `frameloop="never"` when the tab is hidden (`useDocumentVisible`).
- `AdaptiveDpr` is already on the Genesis canvas.
- `useGLTF` + Suspense when real models land. Preload on route intent.
- Custom shaders only after `meshStandardMaterial` fails the look.

## Verify

- [ ] Text readable over the scene (375 and 1280)
- [ ] Console: 0 WebGL errors
- [ ] Mobile: low tier path actually used
- [ ] Unmount does not leak geometries
- [ ] Still-vs-target if `docs/targets/` has a frame for this scene (`helives-gauntlet`)
- [ ] Independent critic SHIP before merge (implementer does not self-approve)
