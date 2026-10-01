# NOVA-154 — Recorder: Pick top 3000 by traded value

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-154 · **Depends on:** NOVA-153

## Goal
In **Live → Config → Stocks to record**, one button fills the selection with the 3,000 synced stocks that trade the most
(D75), so the recorder fits Kite's 3,000 limit with 3,899 stocks synced.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D75
- `frontend/apps/nova-relay/src/pages/live/{RecorderSymbolsModal.tsx,config.test.tsx}`
- `frontend/packages/services/src/queries/marketData.ts` (`useInstruments`, `useUniverse`), `frontend/packages/contracts/src/marketData.ts`

## Files
Create:
- `frontend/apps/nova-relay/src/pages/live/topByTradedValue.ts` (+ `topByTradedValue.test.ts`)
Modify:
- `frontend/apps/nova-relay/src/pages/live/RecorderSymbolsModal.tsx`, `config.test.tsx`
- `docs/guides/USER-GUIDE.md`, `docs/tasks/{BOARD.md,NOVA-154.md}`

## Build
1. `topByTradedValue(synced: string[], instruments: Instrument[], limit)` → symbols sorted by `avgDailyVolume × lastClosePaise`
   descending, ties by symbol; only symbols in `synced`. Stocks without an instrument row (no daily bars) go last, by symbol,
   until `limit` is reached. Pure function, no I/O.
2. In `SymbolsForm`, a secondary button **Pick top 3000 by traded value** (use `MAX_RECORDER_SYMBOLS`) calls it with
   `useInstruments()` and `setSymbols(...)`. Disabled while either query loads; shows the `QueryError` if instruments fail.
   It only fills the selection: the Owner still presses **Save stocks**.
3. A hint under the button: "Ranked by 20-day average volume × last close; stocks with no history rank last."

## Acceptance checks
- [x] Unit test: ranking, ties, unsynced symbols ignored, unranked stocks last, exactly `limit` returned when more exist.
- [x] Modal test: with 3,899 synced mock stocks the button selects 3,000 and Save sends 3,000 symbols.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Backend changes; auto-refreshing the list daily; raising the 3,000 cap or sharding connections.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** `topByTradedValue` (pure ranking by `avgDailyVolume × lastClosePaise`, ties by symbol, unranked synced stocks last by symbol, cut at `limit`); **Pick top 3000 by traded value** button + hint in **Stocks to record**, disabled while the stock list or instruments load (or instruments failed, with `QueryError` + retry). It only fills the selection; **Save stocks** still saves.
**Files changed:** relay `pages/live/{topByTradedValue.ts,topByTradedValue.test.ts,RecorderSymbolsModal.tsx,config.test.tsx}`; USER-GUIDE.
**Commands run:** focused live tests (18 pass); `pnpm review:check` passed (1,063 tests, lint, typecheck, format, builds); demo checked in the browser (button ticks every synced demo stock).
**New dependencies:** none. **Guides updated:** USER-GUIDE (Step 7 Config paragraph, "what do I do if" row). API/DATABASE unchanged.
**Deviations from task:** none. **Known gaps:** none.

## Review
**Result:** done
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner asked for it: the other agents are down; a second pass in the same session, not a fresh one).
**Fixed directly (review: commits):** added a test that **Pick top** is disabled and the error shows when instruments fail; D76 rule tightened (below).
**Change requests (if sent back):** none.
**Checked:** ranking matches D75 (`avg_daily_volume` is the backend's last-20-bar average; volume × close fits safely in a JS number; unsynced ignored; no-history last; exactly 3,000); the button never saves by itself; the 3,000-cap message still shows for hand-picked lists; no backend change; `review:check` passed.
**Known limit:** a stock whose stored history stopped long ago is ranked by its old volume (D75 accepts this; the list is a one-time fill).
**Guides checked:** USER-GUIDE matches (Step 7, table row); API and DATABASE not affected.
**Rulebook issues found:** D76 first draft allowed `docker compose up -d --build <service>`, but every backend service shares `nova-backend:dev`, so that also re-runs `migrate` (new migrations mid-market); `pnpm real` / `real:setup` / `real:stop` run plain `up -d` / `down`. Rule now requires `--no-deps` and bans those scripts in market hours.
**Follow-up tasks created:** none.
