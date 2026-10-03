# NOVA-197 — Signal check: intraday setups on Kite 1m history (D84)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-197 · **Depends on:** NOVA-188, NOVA-189, NOVA-190, NOVA-196 (same Orbit backtest pages)

## Goal
An intraday strategy can also run on `history` data (Kite 1m candles, years back) as a **signal check**
(`docs/INTRADAY-RESEARCH.md` §9): same setups, buying rules and account limits, candle fills, clearly labelled and
never mixed with recorded results. It gives years of evidence on the setup logic while ticks give the fill evidence.

## Read first
- `AGENTS.md` §7a, §8; `docs/DECISIONS.md` D82, D84; `docs/INTRADAY-RESEARCH.md` §5, §9
- `backend/services/backtest/src/nova_backtest/intraday/engine.py`, `tick_data.py`, `fills.py`, `context.py`, `gate.py`; `columns.py` (`load`)

## Files
Create:
- `backend/services/backtest/src/nova_backtest/intraday/candle_data.py`, `candle_fills.py`
- `backend/services/backtest/tests/test_intraday_signal_check.py`
Modify:
- `backend/services/backtest/src/nova_backtest/intraday/engine.py`, `context.py`, `gate.py`
- `backend/services/backtest/src/nova_backtest/routes.py` (allow `history` for intraday), `tests/test_api.py`
- `frontend/apps/nova-orbit/src/pages/backtests/NewBacktestPage.tsx`, `BacktestResultPage.tsx`, `runColumns.tsx`, `backtests.test.tsx`
- `docs/guides/API.md`, `docs/guides/USER-GUIDE.md`

## Build
1. `queue_run`: an intraday strategy may use `dataSource: "history"` (needs 1m candles; same profile/scenario rules).
2. `candle_data.py`: 1m and 5m bars from stored Kite 1m candles (5m built from 1m as D58); VWAP = cumulative bar
   typical price × volume ÷ volume from 09:15 (bar VWAP, not Kite's); index gate from index 1m candles. Session days =
   days with candles; no tick data is read. Previous session levels from the previous candle day.
3. `candle_fills.py`: a decision fills at the next 1m bar's open ± `slippageTicks` × tick size; stops and targets
   trigger on the bar's low/high and fill at the level (or the open on a gap); no spread, depth or quote-age checks;
   the decision log records `spread`, `depth`, `quote_age` as **not tested** (a run-level list, not skip reasons).
4. Everything else (guard, sizing with charges, setups, buying rules, exits, report) is shared code; the run's
   `history_inputs` gets `fills:candle`. Results are labelled: the run page shows a **Signal check — candle fills**
   badge and note "Spread, depth and quote age were not tested"; the History tab list shows the badge too.
5. Experiments stay recorded-only (NOVA-193 unchanged).

## Acceptance checks
- [ ] Same synthetic day as candles and as ticks: identical candidates; fills differ only as the candle model says.
- [ ] A 1-year, 10-stock history run of one setup finishes inside the D61 limits (measure and note the time).
- [ ] API: intraday + history accepted; candle strategies unchanged. UI badge and note shown (tests).
- [ ] `pnpm review:check` and `docker compose run --rm backend-check` pass.

## Out of scope
- Pooling or comparing signal-check numbers with recorded ones in one figure. Experiments on history.
- Deploy: `backtest backtest-worker` with `--no-deps` (no migration).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
