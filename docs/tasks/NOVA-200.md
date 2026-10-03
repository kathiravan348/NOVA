# NOVA-200 — Library: 15 intraday safety entries (5 setups × 3 buying rules) (D84)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-200 · **Depends on:** NOVA-183

## Goal
The Orbit Library offers a new family **H — Intraday safety** with the first-round matrix of
`docs/INTRADAY-RESEARCH.md` §8: five setups × Single / Average on recovery / Add to a winner = 15 entries (H01–H15),
all with default parameters, so the Owner adds the experiment's variants with **Add all** instead of typing them.

## Read first
- `AGENTS.md` §7, §8; `docs/DECISIONS.md` D62 (7), D73, D84; `docs/STRATEGY-LIBRARY.md` (format)
- `backend/services/strategy/src/nova_strategy/library.py`, `library/families.json`, `library/g_intraday.json` (style)

## Files
Create:
- `backend/services/strategy/src/nova_strategy/library/h_intraday_safety.json`
Modify:
- `backend/services/strategy/src/nova_strategy/library.py` (`ENTRY_FILES`), `library/families.json`
- `backend/libs/nova_contracts/src/nova_contracts/library.py` (`LibraryFamilyId` + `intraday_safety`; `LibraryEntryId` `^[A-H][0-9]{2}$`)
- `frontend/packages/contracts/src/library.ts`, `library.test.ts`, `schema/*.json`; `frontend/packages/mocks/data/strategyLibrary.json`
- `backend/services/strategy/tests/test_library_expansion.py` (counts: 115 entries, 8 families); `frontend/apps/nova-orbit/src/pages/library/library.test.tsx`
- `docs/STRATEGY-LIBRARY.md` (section H), `docs/guides/USER-GUIDE.md` (Library: the new family), `docs/CONTRACTS.md`

## Build
1. Family `intraday_safety`, name "H — Intraday safety", idea "Strict-loss intraday setups tested on recorded fills;
   a day with no trade is fine.", watch "Few recorded sessions until 2027: small samples; judge by the experiment".
2. Entries H01–H15 in the order V01–V15 of guide chapter 20 (setup rows: opening range retest, VWAP trend pullback,
   inside bar continuation, failed breakout reclaim, previous day high retest; columns: single, average on recovery,
   add to winner). Names like "H02 Opening range retest · average on recovery"; summary ≤ 140 characters.
3. Each `spec` is the NOVA-183 intraday spec with §3/§4 defaults. `backtest`: NIFTY 100, ₹10,00,000, period
   2026-10-01 → 2026-12-31 (the Library's **Backtest** button then needs a profile in the run form, NOVA-195).
4. The install limit stays 100 per request (Add all of one family = 15).

## Acceptance checks
- [ ] Library loads (service start check) with 115 entries; H entries validate; ids unique; family order kept.
- [ ] Contract tests: `H01` valid, `I01` invalid; mock library includes the family and passes the schema test.
- [ ] Orbit Library page lists the new family (`library.test.tsx`).
- [ ] `pnpm review:check` and `docker compose run --rm backend-check` pass.

## Out of scope
- `vwap_range_reversion` entries (later). Installing them for the Owner (the Owner uses **Add all**).
- Deploy: `strategy` with `--no-deps` (no migration).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
