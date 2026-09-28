# NOVA-138 — Data screens start at 1 Jan 2020 (D69)

**Status:** in-review · **Owner:** Claude · **Branch:** task/NOVA-138 · **Depends on:** —

## Goal
Relay's **New download** and **Stored data** open with **From = 2020-01-01** (today: 365 days back and
5 years back), and `GET /market-data/coverage` without `from` uses 2020-01-01. The date stays editable.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D63, D69; every file under Files

## Files
Modify:
- `frontend/apps/nova-relay/src/lib/format.ts` (add the constant)
- `frontend/apps/nova-relay/src/pages/data-jobs/NewDownloadPage.tsx`
- `frontend/apps/nova-relay/src/pages/data-jobs/downloads.test.tsx`
- `frontend/apps/nova-relay/src/pages/stored-data/StoredDataPage.tsx`
- `frontend/apps/nova-relay/src/pages/stored-data/storedData.test.tsx`
- `backend/services/atlas/src/nova_atlas/coverage.py` (`DEFAULT_YEARS`, `_period`)
- `backend/services/atlas/tests/test_coverage.py`
- `docs/guides/USER-GUIDE.md` (Stored data "the last 5 years at first"; New download From)
- `docs/guides/API.md` (`GET /market-data/coverage` row: default `from`)

## Build
1. `format.ts`: `export const DATA_START_DAY = "2020-01-01";` with a one-line D69 comment.
2. `NewDownloadPage`: `from` starts at `prefill?.from ?? DATA_START_DAY` (Download missing prefill still
   wins). Drop the `istDaysAgo` import there if unused (keep the helper: `ArchiveModal` uses it).
3. `StoredDataPage`: `from` starts at `DATA_START_DAY`; delete `fiveYearsBefore`.
4. `coverage.py`: replace `DEFAULT_YEARS` with `DEFAULT_FROM = date(2020, 1, 1)`. In `_period`, a missing
   `first` becomes `min(DEFAULT_FROM, last)` (a `to` before 2020 must not give a 400). Remove the 29 Feb
   branch.
5. Tests: New download and Stored data show From 2020-01-01 on open; New download opened with a Download
   missing prefill keeps the prefill's From; coverage without `from` counts from 2020-01-01, and with
   `to=2019-06-30` and no `from` answers 200.
6. Guides: update the lines above.

## Acceptance checks
- [x] New download and Stored data open with From = 1 Jan 2020 and To = today; both still editable.
- [x] **Download missing** from Stored data still opens New download with Stored data's period.
- [x] Coverage API default `from` = 2020-01-01; `to` before 2020 without `from` → 200.
- [x] 360px and desktop unchanged apart from the dates. `pnpm review:check` and
      `docker compose run --rm backend-check` pass.

## Out of scope
- New backtest's default period (stays 2 months), Library backtest links, the candles chart API defaults
  (`market_data.py`: 365 / 5 days), Archive modal (30 days), mock fixtures.
- No minimum date: dates before 2020 stay allowed everywhere.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** `DATA_START_DAY = "2020-01-01"` in `format.ts`; New download and Stored data start From there
(Download missing prefill still wins). Coverage API: `DEFAULT_FROM = date(2020, 1, 1)`, a missing `from`
becomes `min(DEFAULT_FROM, to)`; the 29 Feb branch is gone.
**Files changed:** the nine under Files, plus this task and BOARD.md.
**Commands run:** relay data-jobs + stored-data vitest (35 pass); `pnpm review:check`: pass;
`docker compose run --rm backend-check` (ruff, format, mypy, 1,204 tests): pass.
**Tests added:** both screens open with From 2020-01-01; coverage default from 2020-01-01 and `to=2019-06-30`
without `from` → 200 (period 2019-06-30 to 2019-06-30). Prefill keeps its From: existing test
"downloads a group's missing stocks with the chosen period".
**Checked:** 360px / desktop / dark / light: not opened in a browser; only the initial date value changed,
no layout change. **New dependencies:** none. **Maps updated:** none needed.
**Guides:** USER-GUIDE (Stored data and New download From), API (coverage default `from`).
**Deviations from task:** none. `istDaysAgo` kept (ArchiveModal uses it).
**Known gaps:** none.

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
