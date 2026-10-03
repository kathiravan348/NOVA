# NOVA-174 — Trade exit reasons + day ledger endpoints (D82)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-174 · **Depends on:** NOVA-168 (simulator), NOVA-170 (routes, contracts)

## Goal
New trades record why they closed, and two endpoints give a run's day-by-day ledger: buys, sells, charges,
cash, holdings and equity per day, and every buy/sell of one day with the cash after it.

## Read first
- `AGENTS.md` (§1 D76); `docs/DECISIONS.md` rows D53, D60, D61 (4), D82 (9)
- `nova_backtest/{book,simulate,rotation,save,routes,convert}.py`; `nova_contracts/{trade,backtest}.py`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0029_trade_exit_reason.py`
- `backend/services/backtest/src/nova_backtest/ledger.py`, test `backend/services/backtest/tests/test_ledger.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/backtest.py`, `libs/nova_db/tests/test_migrations.py`
- `backend/services/backtest/src/nova_backtest/{book,simulate,rotation,save,routes,convert}.py`, tests
  `test_simulate.py`, `test_rotation.py`, `test_api.py`
- `backend/libs/nova_contracts/src/nova_contracts/{trade,backtest}.py` (+ `__init__.py`), parity tests
- `frontend/packages/contracts/src/{trade,backtest}.ts` (+ tests), generated `schema/*.json`
- `frontend/packages/services/src/{api,queries}/orbit.ts`, `frontend/packages/mocks/src/handlers/orbit.ts` (+ tests)
- `docs/guides/{API.md,DATABASE.md}`, `docs/CONTRACTS.md`

## Build
1. Migration 0029: `trades.exit_reason` text null, check in (`signal`, `stop`, `target`, `time_exit`,
   `square_off`, `market_filter`, `rotation`, `end_of_period`). `Book.close(…, reason)`; every close call in
   `simulate.py` / `rotation.py` passes its reason. Contract `Trade.exitReason` (null for older trades).
2. `ledger.build(trades, equity_curve, initial_cash)`: events = each trade's buy at `entry_at` (amount =
   `qty × exit − gross`, the exact cost incl. averaging adds, shown as one buy at the average price) and sell at
   `exit_at` (amount = `qty × exit`, charges = the trade's total, as the engine pays them at the sell). Cash moves
   exactly as `Book` does. Per IST day: buys, sells, bought, sold, charges, realised net, cash at day end,
   holdings = equity − cash, equity (from the curve), open positions.
3. `GET /backtests/{id}/ledger?offset&limit&from&to&symbol&allDays` → `Page[LedgerDay]` oldest first; default
   only days with events; `symbol` keeps that stock's days and counts (cash/equity stay the portfolio's).
   `GET /backtests/{id}/ledger/{date}?symbol` → `LedgerEvent[]` in time order: `at`, `symbol`, `side`, `qty`,
   `pricePaise`, `amountPaise`, `chargesPaise`, `netPnlPaise` (sells), `reason` (sells), `cashAfterPaise`.
   404 for unknown runs; 400 "Only the newest version keeps the full report" when `reportKept` is false;
   400 when the run is not completed.
4. Check: the last day's cash + holdings = the run's final equity; a test proves it on a seeded run.

## Acceptance checks
- [ ] Stop, target, signal and 15:20 square-off exits save their reasons; old trades read `exitReason: null`.
- [ ] Ledger cash after each event matches a hand-worked 3-trade run; the averaging case uses the exact cost.
- [ ] Paging, `from`/`to`, `symbol`, `allDays` and the three errors have tests; migration up/down test.
- [ ] `pnpm review:check`; `docker compose run --rm backend-check`.
- [ ] Deploy after 15:45 IST or at a weekend: migrate, then `up -d --build --no-deps backtest backtest-worker`.

## Out of scope
- Screens (175), separate rows per averaging add, storing the ledger (it is computed per request).

## Questions

## Handoff
