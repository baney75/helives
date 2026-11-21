---
name: helives-gauntlet
description: >
  He Lives ship gate: verifier table, screenshots at 390 and 1280 in light and
  dark, check-ui, and an independent critic who is never the implementer. Use
  before merging any UI, reading-settings, audio player, voice or security change
  to helives.dev.
---

# He Lives Gauntlet

The implementer never grades its own work. A change ships only after the checks below pass and a separate critic says PASS.

## Ship path
```
implement -> verifiers -> independent critic -> merge -> deploy and read back
```

| Role | Who | May not |
|------|-----|---------|
| Implementer | The agent that edited the files | Judge its own screenshots or declare PASS |
| Critic | A distinct subagent or a fresh session | See the implementer's reasoning or patch files |

## Critic rules
- Spawn a new agent. A second pass in the same context does not count.
- Use a different model family when one is available.
- Give it only: the request, `DESIGN.md`, the verifier table with results, the screenshots and `git diff`.
- It is read-only. It returns `VERDICT: PASS` or `VERDICT: BLOCK` with numbered findings.
- After a BLOCK, fix, rerun the verifiers, and spawn a fresh critic on the new diff. An old PASS does not carry over.

## Verifiers
Run cheap ones first. Each row must pass with evidence.

| # | Check | Pass |
|---|-------|------|
| 1 | `pnpm test` | exit 0 |
| 2 | `pnpm typecheck` | exit 0 |
| 3 | `pnpm lint` | exit 0 |
| 4 | `pnpm build` | exit 0 |
| 5 | `pnpm validate` (if `library/` changed) | exit 0 |
| 6 | `git diff --stat` | only intended paths |
| 7 | `gitleaks git --redact .` | no findings |
| 8 | `node scripts/check-ui.mjs http://localhost:8841` | exit 0 |
| 9 | `node scripts/shots.mjs http://localhost:8841 <dir> <paths>` | 390 and 1280 written, no console errors, no sideways scroll |
| 10 | `SCHEME=dark node scripts/shots.mjs http://localhost:8841 <dir>-dark <paths>` | same, dark |
| 11 | `node scripts/check-listen.mjs http://localhost:8841` (player or audio changes) | exit 0 |
| 12 | `worker/headers.ts` unchanged, or the critic approved the change | no weaker CSP |
| 13 | Independent critic | `VERDICT: PASS` |

Serve with `pnpm build && pnpm exec wrangler dev --port 8841`. Port 8787 is taken; do not use `pnpm dev`.

Screenshot paths to cover at minimum: `/`, a Bible chapter (`/bible/psalms/23/`), a long prose page, and every page the change touches. Open the reading settings sheet in at least one shot when settings changed.

## What the critic checks
- The page matches `DESIGN.md`: tokens, type, layout at 390 and 1280, no motion.
- Text is readable in every theme the change affects. Dusk stays soft.
- Controls are 44px or taller and labeled.
- Nothing decorative competes with the text.
- No Listen button without a manifest entry. No unlabeled Gnostic text.
- The request actually landed.

## Forbidden
- The implementer approving its own screenshots.
- Claiming done because tests passed.
- Deleting or weakening a test, a check script or `worker/headers.ts` to get green.
- Disabling lint or adding `@ts-ignore` to pass.
- Faking audio, a manifest entry or a timing file.
- Committing `.env.local` or any key.

## After merge
Deploy per `RUNBOOK.md` and read back the home page, a Bible chapter, `/api/search?q=grace`, and `curl -sI https://helives.dev/IAM/` (must be 200).

## Caps
Stop after 5 implement and critic rounds and report what still blocks.
