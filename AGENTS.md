# He Lives (helives)

3D Genesis meditation and Scripture site. Home `Claude.md` does not apply here.

## Stack

- React 19 + TypeScript (strict)
- Vite
- `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`
- Cloudflare Workers + static assets (`helives.dev`)
- Vitest for canon routing, cosmology sources, and scene math

## Rules

- R3F/drei first. No new raw Three.js loops in React components unless justified (shaders, instancing).
- HUD text wins. Canvas is the simulation; HUD stays readable.
- Quoted Bible is KJV only. Do not paste NIV/ESV/NASB/NLT.
- Epoch times and scene copy live in `src/genesis/`. Do not invent cosmology numbers without a source in `src/genesis/sources.ts`.
- `?cinematic=1` on `/genesis` is the video pass: captions only, locked camera.
- Phase one ships Genesis only as a live book. `/scriptures` names the whole Protestant canon as forthcoming. Do not add 66 empty book routes.
- Dispose manual geometries/materials.
- Mobile: fewer particles, no bloom.
- Never commit `.env.local` or API keys.

## Commands

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm run deploy
```
