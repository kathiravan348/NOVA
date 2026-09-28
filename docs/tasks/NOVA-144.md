# NOVA-144 — Library: 100 equity strategies across candle sizes and testing protocol

**Status:** ready-for-review · **Owner:** ChatGPT · **Branch:** task/NOVA-144 · **Depends on:** NOVA-121, NOVA-122

## Goal
Add 40 fixed research candidates to the existing 60, covering intraday, overnight swing and daily
position/rotation. Document fair comparison without claiming measured success or future profit (D73).

## Read first
- `AGENTS.md`, `CHATGPT.md`; `docs/DECISIONS.md` D62, D73.
- `docs/STRATEGY-LIBRARY.md`, `docs/STRATEGY-TESTING.md`; every file below.
- `backend/libs/nova_contracts/src/nova_contracts/{strategy,library,indicators}.py`.
- `backend/services/backtest/src/nova_backtest/{rules,columns,bars,rotation,simulate}.py`.

## Files
Create:
- `docs/STRATEGY-TESTING.md`
- `backend/services/strategy/tests/test_library_expansion.py`
- `backend/services/backtest/tests/test_library_signals.py`
Modify:
- `backend/services/strategy/src/nova_strategy/library/{a_rotation,b_trend,c_pullback,ef_hold_baseline,g_intraday,families}.json`
- `backend/services/strategy/src/nova_strategy/library.py`, `backend/services/strategy/tests/test_library.py`
- `docs/STRATEGY-LIBRARY.md`, `docs/guides/{USER-GUIDE,API}.md`, `docs/{STRUCTURE,CONTRACTS}.md`
- `docs/DECISIONS.md`, `docs/PLAN.md`, `docs/tasks/{BOARD,NOVA-144}.md` (planner only scope/decision edits).

## Build
1. Preserve the original 60 entries. Append A13–16, B15–22, C15–20, E03–04, G11–30;
   total A16 B22 C20 D6 E4 F2 G30, using existing IDs/families/contracts and explicit indicator parameters.
2. Write exact rules in STRATEGY-LIBRARY before copying to JSON. Twenty new intraday entries:
   1m2/3m3/5m5/15m4/30m4/1h2; twelve delivery swing: 15m4/30m4/1h4; eight daily delivery.
   New defaults: NIFTY 50 universe and benchmark, capital 100000000 paise, 2023-01-02–2024-12-31;
   visual sizing 10%, max positions intraday5/delivery10; rotation equal weight; no leverage/averaging.
3. Rename the G family to cover 1m–1h; document the new defaults, research status, overnight gap risk,
   derived candle source, exact square-off limitation and daily-index filter requirements.
4. STRATEGY-TESTING: fixed chronological discovery/validation, retrospective vs untouched periods,
   matching benchmark, costs, drawdown, sample size, yearly/concentration checks, related trials,
   D62 aspirations, no universal winner; disclose slippage/spread/impact and survivorship limits.
5. Update USER-GUIDE/API library sections/state and STRUCTURE/CONTRACTS; no wire, DB or screen changes.

## Acceptance checks
- [x] 100 unique IDs/names; counts and timeframes above; all specs/catalog parameters valid.
- [x] Original 60 equal main's entries; independent expected rules for new breakout, reversal and rotation.
- [x] Signals on synthetic bars: past-only channels, no prefix changes after future prices change;
      hand-crafted positive/negative entry and exit examples; indicator warm-up produces no signal.
- [x] API GET returns 100; install all 100 atomically with draft/audit rows; existing invalid-ID tests pass.
- [x] Backend-check and pnpm review:check pass; Definition of done in AGENTS §9.

## Out of scope
- Futures/options, short selling, new indicators/timeframes, execution-cost engine, automatic ranking;
  placing orders, installing into the Owner's database, queueing or claiming real backtest results.

## Questions

## Handoff

- **Done/files:** 40 entries appended to the library JSON; original 60 preserved; library tests, exact rule doc and testing protocol; files listed above.
- **Checks:** backend-check: 1267 passed, ruff/format/mypy pass; pnpm review:check pass. Visual checks not rerun: existing components, data/docs only.
- **Dependencies/maps/guides:** no dependencies; STRUCTURE + CONTRACTS; USER-GUIDE + API. Scope correction: added the stale API guide/contract map references.
- **Gaps:** no measured profitability, historical research runs or automatic ranking; execution/universe limits documented; separate lead review required before merge.
## Review
