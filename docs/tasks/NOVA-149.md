# NOVA-149 — Stored data: Sync to today

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-149 · **Depends on:** NOVA-145

## Goal
One **Sync to today** button on Stored data brings history up to date: for each stock it downloads from the last
stored day (or every missing day) to today, through the existing download plan (D74 (4), D57).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D57, D70, D74
- `frontend/apps/nova-relay/src/pages/stored-data/{StoredDataPage.tsx,MissingDaysModal.tsx}`, `.../data-jobs/{NewDownloadPage.tsx,PlanReview.tsx}`

## Files
Create:
- `frontend/apps/nova-relay/src/pages/stored-data/{SyncToTodayButton.tsx,syncToToday.ts,syncToToday.test.tsx}`
Modify:
- `frontend/apps/nova-relay/src/pages/stored-data/{StoredDataPage.tsx,storedData.test.tsx}`
- `docs/guides/USER-GUIDE.md` (Stored data), `docs/tasks/{BOARD.md,NOVA-149.md}`
- Only if the plan call cannot take per-stock date ranges: `backend/services/atlas/src/nova_atlas/plan.py` (+ test), `docs/guides/API.md`

## Build
1. Button in the page header, label **Sync to today**, showing "Last stored day: 29 Sep 2026" (latest `lastDay` over the
   shown stocks) and the count of stocks with missing days (dates the broker marked unavailable are excluded, D70).
2. Click opens a confirm dialog: stocks, days to fetch, timeframes `1m` and `1d` (D58). **Review plan** goes to the
   plan review with symbols and ranges prefilled (same path as **Download missing**); nothing starts until **Start**.
3. With a group or search active it offers "This group" / "All stocks".
4. Nothing to sync → button disabled with "Up to date".

## Acceptance checks
- [ ] Mock: button shows last stored day and missing count; Review plan lists the right stocks and ranges.
- [ ] Up-to-date state disables it; unavailable days are not requested.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Scheduled automatic sync; the instrument-sync warning (NOVA-150); new timeframes.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — see `docs/templates/REVIEW.md`)_
