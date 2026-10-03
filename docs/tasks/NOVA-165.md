# NOVA-165 — Recorded data shows the daily Kite check

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-165 · **Depends on:** NOVA-164

## Goal
Live → Recorded data shows a **Kite check** card with the latest daily check (match percents, receive delay,
warnings) and the last 10 days, from `GET /live/checks` (D81 item 4).

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D81; task `docs/tasks/NOVA-164.md` (contract `TickCheck`, endpoint)
- `frontend/apps/nova-relay/src/pages/live/RecordedDataPage.tsx`
- `frontend/packages/services/src/{api/live.ts,queries/live.ts,queries/keys.ts}`; `frontend/packages/mocks/src/handlers/live.ts`

## Files
Create:
- `frontend/apps/nova-relay/src/pages/live/KiteCheckCard.tsx`
- `frontend/packages/mocks/data/liveChecks.json`
Modify:
- `frontend/packages/services/src/{api/live.ts,queries/live.ts,queries/keys.ts}` (+ `index.ts` export lines)
- `frontend/packages/mocks/src/{handlers/live.ts,data.ts}`
- `frontend/apps/nova-relay/src/pages/live/{RecordedDataPage.tsx,live.test.tsx}`
- `docs/guides/USER-GUIDE.md` (Step 7b, Recorded data: the Kite check card and what to do on a clock warning)

## Build
1. Services: `getLiveChecks(limit)` + `useLiveChecks()` (limit 10), query key under the live keys; mock handler
   serves `liveChecks.json` (3 days: one clean, one with a clock warning, one with a skipped-stocks warning).
2. `KiteCheckCard`: title **Kite check**, the latest day (e.g. "Thu 1 Oct"), three stats "Minute close 98.7 %",
   "High/low in range 100 %", "Minute volume 97.9 %", "Receive delay 0.4 s", stocks checked/skipped.
   A **Passed** badge when there are no warnings, else **Check** and the warning lines in an amber note.
   **Show days** expands a small list (day, the three percents, badge). Empty: "No check yet — the first runs
   after 16:00 IST on a recorded day." Loading/error states like the other live cards.
3. `RecordedDataPage.tsx`: the card sits above the stock cards, full width; stats wrap to two columns at 360px.

## Acceptance checks
- [ ] `live.test.tsx`: mock data shows the latest day's percents and **Passed**; a warning day shows **Check** and
      its text; **Show days** lists 3 days; the empty state renders with no checks.
- [ ] Screen works at 360px and 1440px in both themes (no horizontal scroll).
- [ ] Definition of done in `AGENTS.md` §9 (`pnpm` lint, typecheck, test, build).
- [ ] Merge only after NOVA-164 is deployed.

## Out of scope
- Backend changes, per-stock drill-down pages, re-running a check, alerts, Monitor and Config pages.

## Questions

## Handoff

## Review
