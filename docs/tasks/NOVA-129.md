# NOVA-129 — Charge rates from 2020: the 2024 schedule backdated (D66, migration 0019, live bug)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-129 · **Depends on:** —

## Goal
Backtests starting between 2020-01-01 and 2024-09-30 get charges instead of failing with
"No … charge rates effective on …": migration 0019 adds the 2024-10-01 values effective 2020-01-01 (D66).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D42, D66; every file under Files

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0019_charge_rates_before_2024.py`
Modify:
- `backend/libs/nova_db/tests/test_migrations.py` (head 0019), `backend/libs/nova_ledger/tests/test_rates.py`
- `docs/guides/DATABASE.md`

## Build
1. Migration 0019 inserts `rate_eqdel_20200101` and `rate_eqint_20200101` (effective 2020-01-01), with the same
   values as 0003 copied in, `source` saying it is an approximation. Downgrade deletes those two ids.
2. Tests: head is 0019; both segments on 2020-01-01 and 2024-09-30 equal the 2024-10-01 rates; 2019-12-31 has none.
3. DATABASE guide: the `charge_rates` row and the migrations range.

## Acceptance checks
- [x] `rates_for` answers for 2020-01-01 to 2024-09-30 in both equity segments; 2019-12-31 still raises.
- [x] Migration downgrade/upgrade round trip passes (`test_migrations`).
- [x] `docker compose run --rm backend-check` passes.

## Out of scope
- Exact older NSE/DP rates (later, as new rows); futures/options rates; engine fallbacks.

## Handoff
Done (Claude, implementer). Migration 0019 + two tests; no model or code change (`rates_for` already picks the
newest row effective on the day). backend-check 1023 passed (ruff, format, mypy strict, pytest). Guide: DATABASE.
- After merge: `docker compose up -d` runs `nova-db-migrate` (0019) before the services; then re-run the failed
  backtests. Runs using a NIFTY 50 market filter also need NIFTY 50 1d prices (Stored data → Indices).

## Review
**Result:** done
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner allowed, 28 Sep 2026, same session at the Owner's request).
**Fixed directly (review: commits):** none.
**Checked:** the copied values equal the live 2024-10-01 rows field by field; ids and the unique (segment,
effective_from) key cannot clash with 0003; the downgrade removes only its own two ids (round-trip test passes).
`rates_for` already takes the newest row effective on the day, so no code change is needed; runs from 2024-10-01 on
are unchanged. backend-check 1023 passed.
**Guides checked:** DATABASE matches (charge_rates row, migrations 0001–0019); API and USER-GUIDE not affected.
**Rulebook issues found:** none.
**Follow-up tasks created:** none (exact older rates stay optional, D66).
