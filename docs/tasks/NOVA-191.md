# NOVA-191 — Intraday mechanics cases: the 12 known cases as tests (D84)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-191 · **Depends on:** NOVA-188, NOVA-189, NOVA-190

## Goal
The 12 mechanics cases of `docs/INTRADAY-RESEARCH.md` §10 run as end-to-end tests of the intraday simulator on
synthetic recorded ticks (through `IntradayEngine.run`, database included), proving chronology, fills, limits and
accounting before any research run. Defects found are fixed here.

## Read first
- `AGENTS.md` §8; `docs/INTRADAY-RESEARCH.md` §5, §10; guide chapter 23 ("Known cases")
- `backend/services/backtest/tests/intraday_factory.py` and the existing `test_intraday_*.py` files

## Files
Create:
- `backend/services/backtest/tests/test_intraday_mechanics.py`
Modify:
- `backend/services/backtest/tests/intraday_factory.py` (helpers: a session of ticks with depth, an index series,
  a frozen profile, a strategy + queued run)
- `backend/services/backtest/src/nova_backtest/intraday/*.py` — **only** to fix defects the cases expose (list each in the handoff)

## Build
1. One test per case, each asserting the run outcome, trades, decision log rows (`first_reason`) and cash:
   (1) healthy data, no setup → completed run, 0 trades, 0 errors; (2) confirmed signal, missing ask → `no_quote`;
   (3) stop before the add confirmation → add cancelled; (4) adverse add that would breach risk → rejected/reduced;
   (5) winner add cut by the fixed stop; (6) two stocks compete for the add pool → priority, pool never exceeded;
   (7) 4th stock → `max_positions`; (8) late quote changes risk → `invalid_at_fill`; (9) partial fill keeps the
   smaller quantity and its charges; (10) no bid at session end → `unresolved`, run `incomplete`, no invented
   profit; (11) two buys = one trade; (12) missing warm-up → `warmup`, no level guessed.
2. A 13th test reconciles one small run by hand: opening cash − buys − charges + sells = final cash, and the sum of
   trade net P&L = the account change.
3. Keep each test ≤ ~40 lines by building data in the factory; no network, no real ticks.

## Acceptance checks
- [ ] All 13 tests pass in `docker compose run --rm backend-check`.
- [ ] Any engine fix has its own assertion in these tests and is listed in the handoff.

## Out of scope
- New behaviour or settings. Report endpoints (192). Performance tuning.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
