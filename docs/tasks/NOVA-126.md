# NOVA-126 — Relay: Stored data page, group by index/sector, Download missing (D63 (4))

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-126 · **Depends on:** NOVA-113, NOVA-123, NOVA-125 · **Merge after:** NOVA-124

## Goal
Relay gets a **Stored data** page. It shows, per stock or index and per timeframe, the stored first and last day, the missing
trading days and a status. It can group rows by index or sector with totals, and **Download missing** opens a pre-filled
New download.

## Read first
- `AGENTS.md` §6–7; `docs/DECISIONS.md` D57, D63; `docs/COMPONENTS.md` (DataTable groups); every file under Files

## Files
Create:
- `frontend/apps/nova-relay/src/pages/stored-data/{StoredDataPage,MissingDaysModal,coverageGroups}.tsx`
- `frontend/apps/nova-relay/src/pages/stored-data/storedData.test.tsx`
Modify:
- `frontend/apps/nova-relay/src/routes.tsx`, `frontend/apps/nova-relay/src/layout/AppLayout.tsx` (menu **Stored data**, `HardDrive` icon, after **Instruments**)
- `frontend/apps/nova-relay/src/pages/data-jobs/{NewDownloadPage.tsx,downloads.test.tsx}` (accept pre-filled values)
- `docs/guides/USER-GUIDE.md`

## Build
1. `StoredDataPage` (`/stored-data`), controls in one card:
   - **Timeframe**: **Daily (1d)** / **1 minute (1m)**, with the hint "3m–1h are built from 1m"
   - **From** / **To**: default the last 5 years
   - **Group by**: **None** / **Index** / **Sector**
   - **Only with gaps**: shows status `gaps`, `partial` or `none`
   - search
   - A note under the controls: "Trading days from NIFTY 50" or "Trading days from stock prices (download NIFTY 50 daily for
     an exact calendar)", from `calendar`.
2. Table (`useCoverage`):
   - Columns: **Symbol**, **Name** (hidden on mobile), **First day**, **Last day**, **Days**, **Missing days**, **Status**.
   - Status badges: **Complete** success, **Gaps** warning, **Partial** info, **No data** neutral.
   - Numbers mono and right-aligned; dates in IST format.
   - Clicking a row opens `MissingDaysModal` (`useCoverageDetail`), which lists the missing ranges ("3 Mar – 5 Mar 2024 · 3 days")
     and has a **Download missing** button.
3. `coverageGroups.tsx` builds the `groups` prop:
   - Index: `row.indices`. Index rows (kind `index`) go under an "Indices" group.
   - Sector: `[row.sector]`.
   - Summary: "{n} stocks · {complete} complete · {gaps} with gaps · {none} no data · {missing} missing days".
   - Action: **Download missing**.
4. **Download missing** (group, modal or single row) navigates to New download with router state
   `{symbols, timeframe, from, to}`. The symbols are those with status ≠ `complete`. More than 200 (the download limit)
   → toast "Too many stocks: pick a smaller group". `NewDownloadPage` reads that state as its starting values, checks them
   with `DataJobPlanRequestSchema`, and ignores bad state. The mode stays **Skip data already there**; the plan review and
   **Start** stay manual.
5. Empty state when there is no data at all: "No prices stored yet" with a link to **New download**.
6. USER-GUIDE Relay: a new step, "Stored data". It explains what each status means, how to find gaps, grouping, and
   Download missing, with the example "check NIFTY 100 daily from 2020 before a 5-year backtest". Also a §7 row:
   "A backtest says prices are missing → Stored data, filter the index, Download missing". Update "State as of".

## Acceptance checks
- [ ] Mock mode:
  - every status shows
  - Group by Index puts RELIANCE under both NIFTY 50 and NIFTY 100
  - group totals match its rows
  - Only with gaps hides complete rows
- [ ] Download missing from a group lands on New download with those stocks, the timeframe and the period filled in (test).
      Bad state is ignored.
- [ ] Checked at 360px (stacked cards, group headers) and desktop, dark and light. `pnpm review:check` passes.
- [ ] Real mode, after NOVA-124: the NIFTY 100 1d group shows the 2020 → today coverage; 1m shows the 2023/2025 starts.

## Out of scope
- Backend (NOVA-124); grouping on other screens; starting downloads without the plan review; per-day calendar views.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
