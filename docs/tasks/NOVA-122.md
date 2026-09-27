# NOVA-122 — Orbit Library page: Add, Add all, Backtest pre-filled (D62 (7))

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-122 · **Depends on:** NOVA-121 · **Merge after:** NOVA-117, NOVA-119

## Goal
Orbit gets a **Library** page. It lists the 60 strategies by family with plain explanations. The Owner can **Add** one or
**Add all** (as drafts), and **Backtest** opens the run form pre-filled with the suggested test (NIFTY 100, ₹10,00,000,
in-sample period, NIFTY 50 benchmark).

## Read first
- `AGENTS.md` §6; `docs/DECISIONS.md` D62; `docs/STRATEGY-LIBRARY.md` §2, §9; every file under Files

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/library/{LibraryPage,LibraryFamilyCard}.tsx`, `frontend/apps/nova-orbit/src/pages/library/library.test.tsx`
Modify:
- `frontend/apps/nova-orbit/src/routes.tsx`, `frontend/apps/nova-orbit/src/layout/AppLayout.tsx` (menu item **Library**, `BookOpen` icon)
- `frontend/apps/nova-orbit/src/pages/backtests/{NewBacktestPage.tsx,backtestForm.ts,backtestForm.test.ts}`
- `docs/guides/USER-GUIDE.md`

## Build
1. `LibraryPage` (`/library`):
   - Intro line: "60 ready-made strategies. Add them as drafts, then backtest. Results are evidence, not promises."
   - **Add all** asks for a confirm: "Add all 60 as draft strategies? Ones you already have are skipped."
   - Family filter chips and a search box.
2. `LibraryFamilyCard`: family name, **Idea**, **Watch out**, then a DataTable of entries: ID, name, summary,
   mode · timeframe, and an **Added** badge when a strategy with that name exists. Row actions:
   - **Add**, disabled once added
   - **Backtest**: adds the strategy first if needed, then goes to
     `/backtests/new?strategy=<id>&index=NIFTY%20100&from=…&to=…&capital=1000000&benchmark=NIFTY%2050&name=…`

   The table becomes stacked cards at 360px.
3. "Already added" is worked out on the client by matching names against `useStrategies()`. Add all installs only the ids
   not added yet. Toast: "Added N strategies". Errors: toast "Could not add" with the server message.
4. `NewBacktestPage` / `backtestForm.ts`: read the optional params `index`, `from`, `to`, `capital` (rupees), `benchmark`
   and `name` as defaults. They are checked like typed input, and a bad value is ignored. The existing `strategy` / `version`
   params keep working.
5. USER-GUIDE: a new Orbit step, "Library". It covers what the families are, how to add strategies, and the 3-step test
   (v1 in-sample → **Edit** to v2 out-of-sample → v3 full 5 years, from `STRATEGY-LIBRARY.md` §9) in plain words, with the
   pass marks. Update "State as of".

## Acceptance checks
- [ ] Mock mode: 7 entries in 7 family cards; Add → toast + **Added** badge; Add all skips added ones.
- [ ] **Backtest** lands on the form with NIFTY 100, ₹10,00,000, 2021-10-01 → 2024-09-30, NIFTY 50 and the name filled in (test).
- [ ] Bad URL params are ignored; the old `?strategy=` links still work.
- [ ] Checked at 360px and desktop, dark and light; `pnpm review:check` passes.

## Out of scope
- Library data or endpoints (NOVA-121); a results leaderboard; queueing many backtests at once.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
