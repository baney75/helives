---
name: helives-gauntlet
description: >
  He Lives gloop overlay: named verifiers, critics, Grok still-vs-target,
  forbidden shortcuts. Use for Genesis/later-book loops, visual QA, voice probes,
  or fix-until-pass on helives.dev.
---

# He Lives Gauntlet

Canonical loop: **`~/.cursor/skills/gloop/SKILL.md`**. No verifiers, no loop. The builder never grades itself.

## When

Multi-shot visual, 3D, voice, or “make this book as good as Genesis” work. One-line copy fixes: just edit + `pnpm test`.

## Named verifiers (cheap first)

| # | Check | Pass | Evidence |
|---|-------|------|----------|
| 1 | `pnpm test` | exit 0 | log |
| 2 | `pnpm typecheck` | exit 0 | log |
| 3 | `pnpm lint` | exit 0 | log |
| 4 | `pnpm build` | exit 0 | log |
| 5 | Diff scope | only intended paths | `git diff --stat` |
| 6 | Secrets | no `.env.local` / API keys in diff | `gitleaks` or grep |
| 7 | Screenshot 375 | home or book HUD readable | `docs/targets/../evidence` or harness artifacts |
| 8 | Screenshot 1280 | same | path |
| 9 | Console | 0 errors (filter error) | CDT / Playwright log |
| 10 | Audio probe | each `VOICED_IDS` file is audio/mpeg, not HTML | `file` / worker 404 test |
| 11 | Still vs target | if `docs/targets/<book>/<scene>.webp` exists, canvas shot compared | overlay/diff note |

Visual rows are equal to tests. Green tests + unread HUD = fail.

Screenshots: `device-verification` (375 + 1280). Prefer Chrome DevTools MCP; Playwright fallback (`pnpm exec playwright`).

## Grok stills as targets

Stills are the look-compare-fix picture, not the product.

1. Generate in Grok Build (`/imagine` or `image_gen`). See `helives-models` for the real CLI fact: no `grok imagine` binary.
2. Compress to webp. Store `docs/targets/<book>/<id>.webp` plus a one-line prompt note in `docs/targets/README.md` or a sibling `.txt`.
3. Capture the running scene at a similar crop.
4. Judge: silhouette, light direction, palette (void/fire/dawn), reverence. Pixel-perfect match is not required; “generic blob vs garden” is a fail.

## Critics (independent)

After the builder stops, spawn a **different model**, read-only:

| Critic | Skill | Asks |
|--------|-------|------|
| Code | `code-reviewer` | BLOCKER/MAJOR on the final diff |
| Check | `check-work` | Did the request actually land? |
| Visual | `gs-design` + this file | Thesis, tokens, still-vs-shot |

Same-session “looks good to me” is not a critic. `VERDICT: SHIP` only with zero BLOCKER/MAJOR and visual rows green.

## Forbidden shortcuts

Name these in the gloop GOAL off-limits before the first ACT:

- Do not delete or weaken tests (`voiced.test.ts`, router/canon tests).
- Do not disable lint or `@ts-ignore` the canvas.
- Do not stub narration with a silent Audio that reports success.
- Do not add empty book routes to make the Scriptures page look done.
- Do not replace authored GLB work with a new Imagine PNG in the canvas.
- Do not revert security headers to unblock a CSP screenshot quirk; fix the probe.
- Do not commit `.env.local` or ElevenLabs keys.
- Do not claim done on tests alone.

## Caps

Default **max 5** builder turns, then ask. Budget exhaustion is a checkpoint, not success. If still-vs-target is red after 5, escalate approach (new mesh, not another bloom tweak).

Graphloop is allowed for multi-node book ships (`plan → build → verify ⇄ build → judge`). Keep the verifier table above in GOAL.md.

## Layout

```
~/.gloop/active/helives-<slug>/
  GOAL.md STATE.md artifacts/
docs/targets/<book>/<scene>.webp
```
