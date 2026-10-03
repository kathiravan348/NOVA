# NOVA-162 — Recorder: real top 3000 (skip iNAVs, warn about unranked stocks)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-162 · **Depends on:** —

## Goal
*Pick top 3000 by traded value* picks real stocks only (no ETF iNAV symbols). When synced stocks have no daily
bars, so they cannot be ranked, the window says so and offers **Download daily bars** (D81 item 1).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D75, D81
- `frontend/apps/nova-relay/src/pages/live/{topByTradedValue.ts,RecorderSymbolsModal.tsx}`
- `frontend/apps/nova-relay/src/pages/stored-data/{syncToToday.ts,UnavailableDataPanel.tsx}` (prefilled plan via `navigate("/data-jobs/new", { state })`)

## Files
Modify:
- `frontend/apps/nova-relay/src/pages/live/topByTradedValue.ts`, test `topByTradedValue.test.ts`
- `frontend/apps/nova-relay/src/pages/live/RecorderSymbolsModal.tsx`, test `config.test.tsx`
- `docs/guides/USER-GUIDE.md` (Live → Config, *Stocks to record*: iNAVs skipped, the warning and its button)

## Build
1. `topByTradedValue.ts`: export `isInav(symbol)` = symbol ends with `INAV`. `topByTradedValue` drops iNAVs before
   ranking (they are neither ranked nor in the unranked tail). Rest unchanged (D75: unranked follow by symbol).
2. Export `unrankedStocks(synced, instruments)`: synced non-iNAV symbols with no instrument row, sorted.
3. `RecorderSymbolsModal.tsx`: when `unrankedStocks` is not empty (and instruments loaded), show a warning above
   the buttons: "{n} stocks have no daily bars, so *Pick top* ranks them last by name. Download their daily bars
   first for a true top {MAX_RECORDER_SYMBOLS}." with a **Download daily bars** button that navigates to
   `/data-jobs/new` with state `{ symbols: <unranked>, timeframe: "1d", from: DATA_START_DAY, to: todayIst(), mode: "skip_existing" }`
   (import the helpers the New download page already uses). The modal closes on navigation.
4. Mock data: no change needed if mocks already have a synced stock without an instrument row; else cover it in tests only.

## Acceptance checks
- [ ] `topByTradedValue` test: an `ABCINAV` symbol with the highest value is not picked; unranked tail has no iNAVs.
- [ ] `unrankedStocks` test: returns synced non-iNAV stocks without an instrument row, sorted.
- [ ] `config.test.tsx`: warning shows the count; **Download daily bars** opens `/data-jobs/new` with those stocks and `1d`; no warning when all are ranked.
- [ ] Definition of done in `AGENTS.md` §9 (`pnpm` lint, typecheck, test, build).

## Out of scope
- Removing iNAVs from the stock list or the instrument sync; backend changes; saving the list automatically.
- Changing the ranking formula (D75) or the "none ticked = record all" rule.

## Questions
_(implementer writes here if blocked)_

## Handoff
- Built by Claude, 3 Oct 2026. `isInav` + `unrankedStocks` in `topByTradedValue.ts`; iNAVs never ranked or picked.
- `RecorderSymbolsModal`: warning with the count and **Download daily bars**.
- Changed from the task text: one download plan holds at most 200 stocks (`MAX_DOWNLOAD_SYMBOLS`), and 1 Oct had
  2,471 unranked, so the button sends batched `syncPlans` (200 each), the same state **Download required data**
  on Instruments uses; New download steps through them (**Plan 1 of N**). Test covers 450 → 200/200/50.
- Checks: lint, typecheck, format, build pass; tests 1,079/1,080. The one failure,
  `approvalBatch.test.tsx` (50 approvals, 20 s timeout), also fails on `main` under full load and passes alone;
  flagged as a separate task.
- Guides: USER-GUIDE (Live → Config).

## Review
Self-review: yes (Owner allowed self-review on 3 Oct 2026). Diff matches the task plus the 200-stock batching
fix above; no backend change, nothing to deploy (Relay picks it up on the next `pnpm real`). Verdict: done.
