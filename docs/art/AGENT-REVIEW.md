# Cerebras adversarial review

`python3 scripts/cerebras-review.py` runs four separate Gemma 4 31B conversations:

1. **Creator** proposes improvements from a small source packet.
2. **Critic** attacks the proposal against that same evidence.
3. **Revision** responds to the objections and specifies checks.
4. **Final critic** challenges the revised proposal.

These are role-isolated API conversations orchestrated by a local script. Each starts with a new system/user context. The critic receives the preceding proposal, and the revision receives the proposal and criticism; private reasoning is not shared. The same model can share blind spots across roles. Its `ACCEPT` verdict approves a proposed direction, **not completed code, rendered artwork, accessibility, or a release**. A human or separate implementation reviewer must inspect the actual result.

The script exposes no writable tools, shell, browser, network selection, dynamic file access, or execution of generated code. A fixed allowlist supplies seven frontend source files, each capped at 14,000 characters and recorded with its SHA-256, plus the last 15,000 characters of src/index.css and the first 15,000 characters of demo/exhibition/checks.json when that local verification report exists. Hashes cover the complete files, while slice labels identify bounded excerpts. Source text and prior outputs are explicitly treated as evidence, not instructions. No screenshots are sent; this is not a vision review. The complete input packet and validated JSON findings are saved under `docs/art/reviews/<UTC timestamp>/` for comparison with the eventual implementation.

## Budget and credentials

The script checks the current model and positive per-token rates using Cerebras' unauthenticated public model endpoint before any paid request. It retains the existing `docs/art/.generation.lock` exclusive lock for the complete run and shares `docs/art/spend.json` with the artwork generators. Each request is pessimistically reserved and persisted before it is sent: twice the UTF-8 input byte count plus framing allowance, with the 3,000-token maximum output allowance. All historical reservations, including failed calls, count toward the lower of the ledger's caps and the hardcoded $4.50 ceiling. This keeps an operating margin below the user's $5 limit. Provider usage produces an estimate, not a verified invoice.

There are exactly four calls in a successful run, no automatic retries, and no unbounded loop. HTTP errors, timeouts, incomplete output and invalid JSON/schema stop the run and retain its reservation. A later manual invocation is a new billable run, not a free resume. The API key is loaded only from the existing local owner-only credential file. It is sent only to the fixed Cerebras chat endpoint; redirects are refused. Neither the key nor error response bodies are written into reports.

Run `python3 scripts/test-cerebras-review.py` for offline checks of budget boundaries, invalid numbers, output validation, endpoint/redirect restrictions and timeout reservation retention.

## Primary references

- [Cerebras Chat Completions](https://inference-docs.cerebras.ai/api-reference/chat-completions): messages, JSON responses, completion bounds and reported usage.
- [Cerebras public models](https://inference-docs.cerebras.ai/api-reference/models/public-models): public model metadata and pricing. The exact fetched rates are saved with every run.

## 2026-09-07 run and interpretation

The first legacy JSON-mode attempt exhausted its 3,000-token cap with malformed repetitive output. It was rejected and the reservation retained. After inspecting that failure, the implementation was changed to Cerebras' [strict JSON Schema output](https://inference-docs.cerebras.ai/capabilities/structured-outputs) and a shorter three-item brief. A new explicit run completed all four roles; there is no retry handler in the script.

Successful run: [`reviews/20260907T180331Z/report.json`](reviews/20260907T180331Z/report.json). Creator: PROPOSE; critic: REVISE; revision: PROPOSE; final critic: REVISE. Successful run estimate: **$0.02012156**. Including the rejected attempt, this review task cost an estimated **$0.02771501**. Cumulative artwork plus review estimate: **$0.07065797**; retained reservations: **$0.56628001** of the $4.50 operating cap. These are recorded usage estimates at fetched rates, not billing reconciliation.

Actionable acceptance checks from the disagreement:

- Rapid navigation plus delayed load callbacks must end on the selected artwork, retaining a visible frame throughout.
- The outgoing image must survive until the incoming opacity transition is complete; verify no flash when it is removed.
- Manual navigation immediately before autoplay advances must begin a complete new viewing interval.
- An unavailable image must leave visible artwork and recover or advance predictably during collection playback.
- Scene-dependent camera direction and a restrained atmosphere layer are reasonable design candidates, subject to actual visual inspection and reduced-motion behavior.

The model's memory-leak allegation is **not established**: the packet includes ArtBackdrop but not its imported reducer, so it cannot know how settling releases layers. Several timing claims are similarly hypotheses. Do not implement the proposed base-layer nullification blindly; confirm reducer behavior and DOM bounds. This is why the report is input to engineering and rendered review, never an automatic release gate.

The final critic may return ACCEPT with no findings; zero to six report items are valid. The prompt explicitly prohibits inventing issues to fill a quota. Eight offline tests now cover packet bounds and optional evidence as well as the financial and failure boundaries.

## Final source and verification rerun

[`reviews/20260907T181356Z/report.json`](reviews/20260907T181356Z/report.json) includes the updated reducer, atmosphere, CSS and actual local browser-check report. All four calls completed; the final critic returned **ACCEPT** for its revised proposal. Run estimate: **$0.04906809**. Cumulative artwork/review estimate: **$0.11972606**; retained reservations: **$0.89216944**.

Independent adjudication of this output is essential. The model repeated claims contradicted by source: the timer already accumulates timestamp deltas and clears its interval; the native modal dialog supplies focus containment; the 2,400ms settle timeout already exceeds the 2,200ms fade. The supplied browser evidence confirms full-minute rotation, manual reset, pause/hidden behavior, late callbacks, failure recovery and focus restoration. These model allegations justify no rewrite. Cached-image revisiting is a useful additional regression check, but the claimed failure was not reproduced. If adding an image-complete fallback, check naturalWidth as well and prevent duplicate readiness notifications. No visual-inspection claim or production-release approval follows from the model's ACCEPT.
