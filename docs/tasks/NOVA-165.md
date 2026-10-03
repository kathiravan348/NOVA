# NOVA-165 — Recorded data shows the daily Kite check

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-165 · **Depends on:** NOVA-164

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
- Built by Claude, 3 Oct 2026. `getLiveChecks` / `useLiveChecks` (+ `queryKeys.live.checks`); mock handler for
  `/live/checks` (bad limit → 400) serving `liveChecks.json` (created in NOVA-164, now in `data.ts`).
- `KiteCheckCard`: latest day, **Passed** / **Check**, four stats (close, range, volume, receive delay), warning
  lines, **Show days** list; loading, error, empty states. Sits above the stock cards on Recorded data.
- Checked in the browser (mock mode): 375 px (two stat columns, no horizontal scroll), 1440 px (four columns),
  dark and light.
- Checks: lint, typecheck, format, build pass; tests 1,085/1,086 (the flaky `approvalBatch` test, also on main).
- Guides: USER-GUIDE (Step 7b: Kite check card, what to do on a clock warning).

## Review
Self-review: yes (Owner allowed self-review on 3 Oct 2026). Matches the task; merged after NOVA-164 was deployed.
Frontend only: nothing to deploy. Verdict: done.
