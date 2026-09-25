# NOVA-069 — Cost averaging: spec contract + backtest engine (D53)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-069 · **Depends on:** NOVA-066

## Goal
A strategy can ask the backtest to buy more of a stock it holds each time the price falls X% below the last
buy, up to N extra buys. Stop-loss and target follow the average price, and the position stays one trade.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` (D45, D46, D53)
- `backend/services/backtest/src/nova_backtest/simulate.py`, `tests/test_simulate.py`

## Files
Modify: `frontend/packages/contracts/src/{strategy.ts,strategy.test.ts}`, `contracts/schema/*.json` (regenerated),
`backend/libs/nova_contracts/src/nova_contracts/strategy.py`, `nova_contracts/tests/test_strategy.py`,
`backend/services/backtest/src/nova_backtest/{simulate.py,strategy_engine.py}`, `tests/test_simulate.py`,
`docs/guides/API.md`, `docs/CONTRACTS.md`

## Build
1. Contract `Averaging {dropPercent: > 0 and ≤ 50, maxAdds: whole 1–10}`; optional `averaging` on both spec
   modes (absent = off). Python: `Averaging | None = None`, excluded from the dump when `None` (old specs
   round-trip byte-identical). Parity tests.
2. `simulate(..., averaging=None)`: `_Position` keeps `cost` (exact paise), `last_buy`, `adds`. While holding and
   `adds < maxAdds`: trigger = last buy × (1 − drop%) (half-up paise). If the bar's low reaches it and the
   trigger is above the stop price, buy `shares(sizing, worth(), fill)` at fill = min(open, trigger) if cash
   allows; repeat for the next trigger in the same bar. Then stop/target from the average (cost / qty).
3. `ClosedTrade` gets `cost`; `entry_price` = average (half-up); `gross` = exit × qty − cost.
4. `strategy_engine.py` passes `spec.averaging` to `simulate`.
5. `API.md` / `CONTRACTS.md`: the `averaging` field and its rules.

## Acceptance checks
- [ ] Hand-checked simulate tests: two adds on a falling series (qty, average, exact cost, cash); maxAdds caps;
      a gap fills at the open; stop from the average; stop above the trigger closes without adding;
      no cash → no add; `averaging=None` gives today's results (existing tests unchanged).
- [ ] Contract: absent / valid accepted, drop 0 or 51 and maxAdds 0, 11 or 1.5 refused (both sides).
- [ ] `backend-check`, `pnpm review:check` pass. AGENTS §9.

## Out of scope
- Editor fields and texts (NOVA-071). Showing the number of buys per trade. Selling part of a position.

## Questions

## Handoff
Built by Claude (Antigravity offline); rules chosen by the Owner 2026-09-25 (D53). All acceptance checks pass.
- Contract `Averaging` (TS + Python, excluded from the dump when off → old specs unchanged); schemas regenerated.
- `simulate(..., averaging)`: `_Position` keeps exact `cost`, `last_buy`, `adds`; resting buys at the trigger,
  gap fills at the open, a stop at/above the trigger wins; stop/target from the average.
- `ClosedTrade.cost` (optional) → gross = exit × qty − cost, so cash, equity and trades agree exactly.
- Checks: Docker pytest backtest + strategy + contracts 226 passed; `pnpm review:check` green.
- Guides: API.md (averaging). USER-GUIDE comes with the editor (071).

## Review
Self-reviewed. Hand-checked: two adds + gap + cap (cost ₹2,700, avg ₹90), stop from average 83.60, stop-first, no cash.
