# NOVA-134 — Instrument sync keeps hyphenated stocks such as BAJAJ-AUTO (D68, live bug)

**Status:** in-progress · **Owner:** Claude · **Branch:** task/NOVA-134 · **Depends on:** —

## Goal
The next instrument sync adds BAJAJ-AUTO (and every other NSE stock whose symbol has a hyphen), so NIFTY 100
has 100 members and NIFTY 50 has 50; bonds, SGBs and G-secs are still skipped (D68 (1)).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D56, D68; every file under Files

## Files
Modify:
- `backend/services/atlas/src/nova_atlas/universe.py` (`STOCK_SYMBOL` only)
- `backend/services/atlas/tests/test_universe.py`

## Build
1. `STOCK_SYMBOL` = `^[A-Z0-9&]+(-[A-Z0-9&]{3,})*(-(BE|BZ|SM|ST))?$`. The 20-character limit next to it stays.
2. `test_kite_list_keeps_stocks_and_skips_bonds`: add `BAJAJ-AUTO` and `NAM-INDIA` (kept), `ACME-RE` and
   `SGBMAR28-GB` (skipped) to the rows and the expected list.

## Acceptance checks
- [ ] The test keeps INFY, ABCD-SM, XYZ-BE, BAJAJ-AUTO, NAM-INDIA; skips SG, GS, N1, RE, GB rows.
- [ ] `docker compose run --rm backend-check` passes.

## Out of scope
- Running the sync or downloading BAJAJ-AUTO prices (Owner, in Relay, after merge).
- Contracts (symbol schema already allows `-`), screens, guides (Guides: none).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
