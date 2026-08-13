---
name: helives-gauntlet
description: >
  He Lives gloop overlay: verifier-first loops, separate critic/judge (never the
  implementer), Grok still-vs-target, forbidden shortcuts. Use for Genesis or
  later-book loops, visual QA, voice probes, or fix-until-pass on helives.dev.
---

# He Lives Gauntlet

Canonical loop: **`~/.cursor/skills/gloop/SKILL.md`**. No verifiers, no loop.

**Critics MUST be separate from the implementer.** This is not optional polish. The builder never grades itself.

## Ship path (hard)

```
implement → independent critic → only then merge/ship
```

| Role | Who | May not |
|------|-----|---------|
| Implementer | The agent that edited the files | Grade its own work, approve its own screenshots, declare SHIP |
| Critic / judge | A **distinct** subagent or pass | Inherit the implementer’s “I fixed it” chat |

Critic requirements (all of them):

1. **Distinct agent** — new Task/subagent, or a forced fresh review. Not the same turn’s narrator.
2. **Different model when available** — not a second prompt on the same model if another family is available (gloop: builder and judge should be different families).
3. **No implementer context** — critic sees GOAL.md, verifier table, artifacts, and `git diff` only. It does not see the builder’s reasoning.
4. **Read-only** — critic does not patch. It returns a structured verdict.

Minimum if subagents are unavailable: a **cold re-read** in a new session with only the contract + diff + evidence. Same-session “now I will review myself” does **not** count.

## Forbidden (name in GOAL off-limits before ACT)

- Implementer self-approving screenshots
- “Looks good to me”
- Same agent writing then rubber-stamping
- Same-context self-grade counting as `code-reviewer` or `check-work`
- Claiming SHIP because tests passed and the builder liked the PNG

## When

Multi-shot visual, 3D, voice, or “make this book as good as Genesis” work. One-line copy fixes: edit + `pnpm test`. Material UI/3D/voice/security still needs the independent critic before merge.

## Named verifiers (cheap first)

| # | Check | Pass | Evidence |
|---|-------|------|----------|
| 1 | `pnpm test` | exit 0 | log |
| 2 | `pnpm typecheck` | exit 0 | log |
| 3 | `pnpm lint` | exit 0 | log |
| 4 | `pnpm build` | exit 0 | log |
| 5 | Diff scope | only intended paths | `git diff --stat` |
| 6 | Secrets | no `.env.local` / API keys in diff | `gitleaks` or grep |
| 7 | Screenshot 375 | home or book HUD readable | harness artifacts |
| 8 | Screenshot 1280 | same | path |
| 9 | Console | 0 errors (filter error) | CDT / Playwright log |
| 10 | Audio probe | each `VOICED_IDS` file is audio/mpeg, not HTML | `file` / worker 404 test |
| 11 | Still vs target | if `docs/targets/<book>/<scene>.webp` exists, canvas shot compared | overlay/diff note |
| 12 | Independent critic | distinct agent SHIP / PASS | critic verdict path |

Visual rows are equal to tests. Green tests + unread HUD = fail. Rows 1–11 without row 12 = **not shipped**.

Screenshots: `device-verification` (375 + 1280). Prefer Chrome DevTools MCP; Playwright fallback (`pnpm capture --out <dir>` after `pnpm build`, or `pnpm exec playwright`). Beats: `/genesis?pause=1&progress=0.02|0.65|0.745`. The implementer **captures**; the critic **judges**.

## Grok stills as targets

Stills are the look-compare-fix picture, not the product.

1. Generate in Grok Build (`/imagine` or `image_gen`). See `helives-models` for the real CLI fact: no `grok imagine` binary.
2. Compress to webp. Store `docs/targets/<book>/<id>.webp` plus a one-line prompt note in `docs/targets/README.md` or a sibling `.txt`.
3. Implementer captures the running scene at a similar crop.
4. **Critic** (not the implementer) judges silhouette, light direction, palette (void/fire/dawn), reverence. Pixel-perfect match is not required; “generic blob vs garden” is a fail.

## Critics (who to spawn)

After the builder stops, spawn **separate** read-only passes:

| Critic | Skill | Asks |
|--------|-------|------|
| Code | `code-reviewer` | BLOCKER/MAJOR on the **final** diff |
| Check | `check-work` | Did the request actually land? |
| Visual | `gs-design` + this file | Thesis, tokens, still-vs-shot |

`VERDICT: SHIP` / `VERDICT: PASS` only with zero BLOCKER/MAJOR, visual rows green, **and** the critic was not the implementer.

If the critic BLOCKs: implementer fixes, then **re-spawn** the critic on the new diff. The old SHIP does not carry forward.

## Other forbidden shortcuts

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

Graphloop for multi-node book ships: `plan → build → verify ⇄ build → judge ⇄ build → ship_review`. The `judge` and `ship_review` nodes are **not** the builder. Keep the verifier table above in GOAL.md.

## Layout

```
~/.gloop/active/helives-<slug>/
  GOAL.md STATE.md artifacts/  # critic verdicts live in artifacts/
docs/targets/<book>/<scene>.webp
```
