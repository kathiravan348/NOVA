# NOVA-021 — Review build: one-command local run, demo walkthrough, feedback checklist

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-021 · **Depends on:** NOVA-018, NOVA-020, NOVA-029

## Goal
The owner can start the whole Stage A prototype with one command, follow a short walkthrough of every screen, and record feedback in a checklist that feeds the scope freeze (NOVA-022).

## Read first
- `AGENTS.md` (§1, §9), `docs/PLAN.md`, `docs/STRUCTURE.md`, `START-HERE.md`
- `frontend/package.json`, both apps' `routes.tsx` (screen list), `frontend/packages/ui-storybook/package.json`

## Files
Create: `docs/REVIEW-GUIDE.md`
Modify: `frontend/package.json` (scripts only), `docs/STRUCTURE.md`, `START-HERE.md` (one line pointing to the guide)

## Build
1. `frontend/package.json` scripts: `"review": "pnpm --filter nova-orbit --filter nova-relay --filter @nova/ui-storybook --parallel run dev"` (Orbit :3000, Relay :3001, Storybook :6006) and `"review:check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check"`. No new dependencies.
2. `docs/REVIEW-GUIDE.md` (≤ 150 lines), sections:
   - **Start**: prerequisites (Node 24, pnpm 12), `cd frontend`, `pnpm install`, `pnpm review`, the three URLs, how to stop (Ctrl+C). Sign-in: any username/password (demo). Everything is mock data (`DemoBanner`), nothing reaches Zerodha.
   - **Walkthrough**: numbered steps through every screen with what to look at: Orbit — strategies list → strategy detail (spec in words, versions) → edit (visual rules, spec preview) → new strategy in Python mode → run backtest form → results (metrics, equity vs NIFTY 50, trades, charges modal) → compare two runs → market data (daily/5m, IST times). Relay — overview (daily login prompt) → accounts → rate limits → data jobs → audit filter. Plus: theme toggle, phone width (browser dev tools 360px), Storybook tour.
   - **Feedback checklist**: per screen, 3–5 checkbox questions the owner answers (e.g. "Are these the metrics you want first?", "Is anything missing from a trade row?", "Should the daily login prompt block anything?"), plus a free-text "Other notes" block and a "Scope decisions" list (open items from `docs/DECISIONS.md` Pending: options data vendor, family roles, domain/trademark).
   - **Known limits of the prototype** (not bugs): nothing is saved, no real runs, fixed mock dates (Sept 2026), no pagination API.
3. `STRUCTURE.md`: add `REVIEW-GUIDE.md` to the docs line. `START-HERE.md`: add "Reviewing Stage A: see `docs/REVIEW-GUIDE.md`."
4. Verify: run `pnpm review` and open all three URLs (each loads, sign-in works); run `pnpm review:check` (all pass).

## Acceptance checks
- [ ] `pnpm review` starts all three servers from `frontend/` with one command on Windows.
- [ ] Every route in both apps appears in the walkthrough; every walkthrough step works as written.
- [ ] Definition of done in `AGENTS.md` §9 (no code changes beyond scripts).

## Out of scope
- Deploying anywhere, Docker, a production server, recording videos, answering the checklist (that is the owner's part, then NOVA-022).

## Questions

## Handoff
**Done:** `pnpm review` (Orbit :3000, Relay :3001, Storybook :6006 in parallel), `pnpm review:check`, `docs/REVIEW-GUIDE.md` (start, 16-step walkthrough, feedback checklist, known limits).
**Files changed:** as listed.
**Commands run:** `pnpm review` → Orbit and Relay served 200 (Storybook skipped here only because port 6006 was already taken by another session); lint / typecheck / test / build / format:check → all pass (yes)
**Checked:** every walkthrough step was exercised in NOVA-013…029 browser checks.
**New dependencies:** none.
**Maps updated:** STRUCTURE.
**Deviations from task:** none.
**Known gaps:** none.

## Review
**Result:** done (built by Claude while Gemini is offline)
**Fixed directly (review: commits):** none.
**Rulebook issues found:** none.
**Follow-up tasks created:** none. NOVA-022 needs the owner's filled checklist.
