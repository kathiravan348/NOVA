# NOVA-113 — Index candles: download indices like stocks (Atlas + Relay) (D62)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-113 · **Depends on:** —

## Goal
An index from `market_indices` (e.g. NIFTY 50) can be downloaded from Relay like a stock, in 1m or 1d. Its candles
are stored with `symbol` = the index name (D62 (2)). Later, backtests use them for the benchmark (NOVA-116) and for
the market filter (NOVA-117).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D56, D57, D58, D62; every file under Files

## Files
Create:
- `backend/services/atlas/src/nova_atlas/tokens.py`
- `frontend/apps/nova-relay/src/pages/data-jobs/IndexPicker.tsx`
Modify:
- `backend/services/atlas/src/nova_atlas/{plan,download}.py`
- `backend/services/atlas/tests/{test_plan,test_download}.py`
- `frontend/apps/nova-relay/src/pages/data-jobs/NewDownloadPage.tsx`, `frontend/apps/nova-relay/src/pages/data-jobs/downloads.test.tsx`
- `docs/guides/API.md`, `docs/guides/DATABASE.md`, `docs/guides/USER-GUIDE.md`

## Build
1. `tokens.py`: `kite_tokens(db, exchange, symbols) -> dict[str, int | None]`. It looks each name up in `instruments`
   (exchange + symbol) first, then in `market_indices.name`. `None` means known but not synced with Kite yet;
   a name in neither table is left out of the result.
2. `plan.check_request`: a name is valid if it is in the stock list **or** is a `market_indices` name. The error
   text becomes "Not in the stock list or the indices: …".
3. `plan.build_plan` and `download.run_download`: use `kite_tokens` for the "synced" set and for the tokens. The
   messages stay the same, except they say "Sync with Kite on Instruments" for indices too.
4. Candles for an index are written like a stock's (`exchange` `NSE`, `symbol` = index name, volume 0 is fine).
   There is no migration: `candles` has no foreign key to `instruments`. Coverage, skip-existing and overwrite work
   unchanged.
5. `IndexPicker.tsx`: a checkbox list of `useMarketIndices()` names in a card titled **Indices** with the hint
   "Index prices, used for the benchmark and the market filter". The chosen names are added to the same `symbols` list
   the stock picker fills, so the plan review shows them as rows. Clear removes them too. The title count stays right:
   **Stocks and indices (N chosen)**.
6. Guides: API (`POST /data-jobs/plan` and `/data-jobs` accept index names); DATABASE (`candles.symbol` can be an
   index name); USER-GUIDE Relay Step 7 (how to download NIFTY 50 daily prices from 1 Jan 2020). Update "State as of" in each.

## Acceptance checks
- [ ] pytest: a plan with `["RELIANCE", "NIFTY 50"]` has steps for both. An unknown name → 400. An index without a token
      → the not-synced warning, and the job ends with the not-synced message (FakeBroker, no Kite).
- [ ] pytest: a download of `NIFTY 50` 1d writes candles with `symbol = 'NIFTY 50'`, and skip-existing skips them on a rerun.
- [ ] Vitest: ticking NIFTY 50 adds it to the request, plan review lists it, Clear removes it.
- [ ] Real mode: the Owner queues NIFTY 50 and NIFTY 100 1d from 2020-01-01. (The implementer tests only with a
      2-day 1d download of NIFTY 50.) `select count(*) from candles where symbol = 'NIFTY 50'` > 0.
- [ ] Definition of done in `AGENTS.md` §9 (backend-check; Relay at 360px and desktop, dark and light).

## Out of scope
- Using index candles in backtests (benchmark: NOVA-116; market filter: NOVA-117); showing indices on Market data.
- Recording index ticks; any migration; changes to the stock list or the sync job.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
