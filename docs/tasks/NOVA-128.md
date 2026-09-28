# NOVA-128 — Stored data: every index listed; later listings count as complete (D65, live bug)

**Status:** ready-for-review · **Owner:** Claude · **Branch:** task/NOVA-128 · **Depends on:** NOVA-124, NOVA-126

## Goal
Stored data lists NIFTY 50 and every other index even before it has candles, so **Download missing** can fetch it
(every backtest with a NIFTY 50 market filter failed without it). Stocks listed during the period stop showing as
`partial` once a download has asked Kite for the days before their listing (D65).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D63, D65; every file under Files

## Files
Modify:
- `backend/services/atlas/src/nova_atlas/coverage.py`, `backend/services/atlas/tests/test_coverage.py`
- `docs/guides/{API,USER-GUIDE}.md`

## Build
1. `list_coverage`: add a row for every `market_indices` name; one without candles gets status `none`.
2. `_series`: read, per symbol, the earliest `start_at` (IST date) of `done` steps of downloads in that
   exchange and timeframe (one grouped query over `data_job_steps` joined to `data_jobs`).
3. `_numbers`: a later start is not `partial` when at least one calendar day lies in [asked from, first day).
4. Guides: the coverage row in API; Stored data statuses and the NIFTY 50 hint in USER-GUIDE.

## Acceptance checks
- [ ] Tests: listed later + asked earlier → `complete`; asked only from the first day, asked only over a
      weekend, or asked in another timeframe → `partial`; an index without candles → `none` row.
- [ ] Owner DB: 1d NIFTY 100 shows 99/99 complete (was 94 + 5 partial); the list query stays < 100 ms.
- [ ] `docker compose run --rm backend-check` passes.

## Out of scope
- Contracts or the Relay page (no field changes); delisted stocks that end early; a stored listing date.

## Handoff
Done (Claude, implementer). `coverage.py`: every `market_indices` name gets a row (`none` without candles);
`_ASKED_FROM` (earliest done-step start per symbol for the timeframe) and `_listed_later` drop the late-start part of
`partial`. No contract or frontend change: the page already groups index rows under "Indices" and New download
already accepts index names.
- Owner DB (read-only run of the new module): 1d = 99/99 complete (ENRIN, HYUNDAI, JIOFIN, TATACAP, TMCV were
  partial); 1m = 99 complete + 11 partial (AEGISLOG, IGL, OIL, … were only asked from 26 Sep 2025: truly missing).
  `_series` 56 ms (1d), 58 ms (1m).
- Commands: backend-check 1021 passed (ruff, format, mypy strict, pytest). Guides: API, USER-GUIDE.
- After merge: restart `atlas-api`; then Stored data → Indices → NIFTY 50 → Download missing (1d) unblocks the
  48 strategies with a NIFTY 50 market filter.

## Review
_(reviewer — ChatGPT, or Claude in a fresh session if the Owner allows a self-review; ≤ 20 lines — see `docs/templates/REVIEW.md`)_
