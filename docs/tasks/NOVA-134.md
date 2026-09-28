# NOVA-134 — Instrument sync keeps hyphenated stocks such as BAJAJ-AUTO (D68, live bug)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-134 · **Depends on:** —

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
- [x] The test keeps INFY, ABCD-SM, XYZ-BE, BAJAJ-AUTO, NAM-INDIA; skips SG, GS, N1, RE, GB rows.
- [x] `docker compose run --rm backend-check` passes.

## Out of scope
- Running the sync or downloading BAJAJ-AUTO prices (Owner, in Relay, after merge).
- Contracts (symbol schema already allows `-`), screens, guides (Guides: none).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Continued by ChatGPT; retained Claude's existing symbol-filter fix and regression cases.
Hyphenated stock names (BAJAJ-AUTO, NAM-INDIA) are kept; SG/GS/N1/RE/GB suffixes remain skipped.
The existing 20-character limit is preserved.
**Files changed:** backend/services/atlas/src/nova_atlas/universe.py;
backend/services/atlas/tests/test_universe.py; docs/tasks/BOARD.md; docs/tasks/NOVA-134.md.
**Commands run:** backend-check (ruff, format, mypy, 1,203 tests) and frontend review:check
(format, lint, typecheck, 957 tests, app + Storybook builds): pass on current main plus this task.
**Checked:** 360px / desktop / dark / light: N/A (no UI changes).
**New dependencies:** none. **Maps updated:** none. **Guides:** none.
**Deviations from task:** none. **Known gaps:** Live sync/downloads not run (out of scope).
After merge, Owner rebuilds Atlas, runs **Sync with Kite**, then downloads BAJAJ-AUTO prices in Relay.

## Review
**Result:** done
**Reviewer / built by:** Claude / Claude (code, 86ada46), ChatGPT (update from main, checks, handoff).
**Self-review:** yes (Owner allowed, fresh session).
**Checked:** diff matches Build 1–2 exactly; `STOCK_SYMBOL` is linear (hyphen splits the parts, no backtracking);
20-character limit kept; test covers kept (BAJAJ-AUTO, NAM-INDIA) and skipped (-RE, -GB) rows.
backend-check (1,203 tests) and `pnpm review:check` pass; branch up to date with main.
**Fixed directly (review: commits):** none.
**Guides checked:** not affected (sync filter only; no screen, endpoint or table change).
**Rulebook issues found:** none.
**Follow-up tasks created:** none. Owner, after merge: rebuild Atlas, run **Sync with Kite**, download BAJAJ-AUTO prices.
