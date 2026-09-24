# NOVA-053 — Ledger: charges engine (equity delivery + intraday), dated rate tables

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-053 · **Depends on:** NOVA-047

## Goal
Every backtest trade can get exact Indian charges (brokerage, STT, exchange txn, SEBI fee, stamp duty, GST, DP) in
integer paise from rate rows with effective dates, for equity delivery and intraday (D42). Futures/options rates later.

## Read first
- `AGENTS.md` (§7, §8), `docs/ARCHITECTURE.md` (Fees and taxes), `docs/DECISIONS.md` (D10, D17, D37, D42)
- `frontend/packages/contracts/src/{charges.ts,trade.ts}`, `frontend/packages/mocks/data/trades.json`

## Files
Create: `backend/libs/nova_ledger/{pyproject.toml,src/nova_ledger/{__init__.py,py.typed,rates.py,charges.py},tests/{conftest.py,test_charges.py,test_rates.py}}`,
`nova_db/migrations/versions/rev0003_charge_rates.py`, `nova_contracts/charges.py` + `tests/test_charges.py`
Modify: `nova_db/models/{__init__.py,data.py}` (`ChargeRate`), `nova_db/tests/test_migrations.py`, `nova_contracts/__init__.py`,
`backend/pyproject.toml`, `uv.lock`, `docs/{DECISIONS,STRUCTURE,ARCHITECTURE,CONTRACTS}.md`

## Build
1. `charge_rates (id, segment, effective_from, rates jsonb, source, created_at)`, unique `(segment, effective_from)`.
   Migration 0003 seeds Zerodha rates effective 2024-10-01 (source: zerodha.com/charges): delivery — brokerage 0,
   STT 0.1% buy+sell, NSE txn 0.00297%, SEBI ₹10/crore, stamp 0.015% buy, GST 18%, DP ₹13 per sell; intraday —
   brokerage min(0.03%, ₹20)/order, STT 0.025% sell, txn 0.00297%, SEBI ₹10/crore, stamp 0.003% buy, GST 18%.
2. `ChargeRates` (Pydantic, Decimal strings, extra forbidden); `rates_for(db, segment, day)` = newest row effective
   on `day` (error when none).
3. `trade_charges(rates, side, qty, entry_price, exit_price | None) -> Charges`: buy and sell legs from `side`;
   Decimal maths; components rounded half-up to paise, STT to the rupee; GST = 18% × (brokerage + txn + SEBI + DP);
   total = sum of rounded components. No exit → entry leg only.
4. Pydantic `Charges` (total refinement); parity vs every trade's charges in the mock.

## Acceptance checks
- [x] Hand-worked examples: delivery 100 @ ₹1,000 → ₹1,100 = ₹247.95; intraday 100 @ ₹1,000 → ₹1,010 = ₹82.48;
      short intraday; open trade; lookup picks the rate row by date. Contract parity. `backend-check` passes.

## Out of scope
- Futures/options rates (with their engines), tax (STCG/LTCG), an HTTP API, editing rates from a screen.

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). `nova_ledger` (rates + charges), migration 0003 with seed rates.
**Commands run:** `backend-check` pass (241 tests); worked examples ₹247.95 (delivery) and ₹82.48 (intraday) exact.
**New dependencies:** none.
**Deviations:** none.
**Known gaps:** the seeded schedule is from 2024-10-01; the Owner should compare it with zerodha.com/charges today and
add a newer row if anything changed. DP is charged per sell leg (Zerodha: per scrip per day).

## Review
**Result:** done
**Fixed directly:** tests compared snake_case keys with camelCase dumps (`by_alias=False`).
**Rulebook issues found:** none. **Follow-up tasks created:** none.
