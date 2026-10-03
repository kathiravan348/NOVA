# NOVA-190 — Intraday buying rules: single, average on recovery, add to winner (D84)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-190 · **Depends on:** NOVA-187

## Goal
The `buying` part of an intraday strategy works as `docs/INTRADAY-RESEARCH.md` §4 says: a first buy of
`initialPercent` of the permitted quantity and at most one conditional add, limited by the remaining risk with the
original stop and target unchanged. The position stays one trade with its legs recorded.

## Read first
- `AGENTS.md` §8; `docs/INTRADAY-RESEARCH.md` §4, §5, §10; guide chapters 15–16 (worked numbers)
- `backend/services/backtest/src/nova_backtest/intraday/replay.py`, `position.py`, `guard.py`, `sizing.py`, `decisions.py`

## Files
Create:
- `backend/services/backtest/src/nova_backtest/intraday/buying.py`
- `backend/services/backtest/tests/test_intraday_buying.py`
Modify:
- `backend/services/backtest/src/nova_backtest/intraday/replay.py`, `position.py`, `sizing.py`, `guard.py`

## Build
1. First buy: `single` = 100 % of the quantity `sizing.py` permits; the other two = `initialPercent` of it (floor,
   ≥ 1 share or skip with `zero_qty`). The risk allowance is for the **whole** position; the first buy leaves room.
2. `average_on_recovery`: after a tick at ≤ first fill − `triggerAtr` × ATR (ATR at the first fill), wait for
   `confirmBars` completed 1m closes each above the previous bar's high, within `expiryMinutes` of the trigger.
   `add_to_winner`: trigger at ≥ first fill + `triggerR` × R, same confirmation and expiry.
3. The add becomes an `add` decision (log row) and goes through every guard check again (incl. `add_pool`, entry
   window, daily shutdown, data) and the fill model. Quantity = the smallest of: remaining position risk with the
   **unchanged** stop at the add price incl. costs, add pool, stock/sector cap, cash, depth. Zero → no add (logged).
4. A stop, target, time exit or shutdown before the add fills cancels it. Stop, target and `risk_paise` never move;
   the trade's entry price is the average, qty is all shares, `intraday_trades.legs` lists each buy. Max hold
   counts from the first fill.

## Acceptance checks
- [ ] Guide ch. 16 table as tests (simplified ₹100 cost reserve via a test charges function): 315 at ₹100 first;
      adverse add 135 at ₹99 → ₹765 price risk; winner add at ₹102 cut from 135 to 67 shares.
- [ ] Stop before the add confirmation → add cancelled; add after expiry → none; add at/after 14:30 → `entry_window`.
- [ ] Two stocks competing for the add pool → ranked order, never above the pool.
- [ ] A position with two buys is one trade; legs saved; stop and target unchanged after the add.
- [ ] `docker compose run --rm backend-check` passes.

## Out of scope
- More than one add, trailing/break-even exits (later variants); the matched add-impact report (192).
- Deploy: `backtest backtest-worker` with `--no-deps` (no migration).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
