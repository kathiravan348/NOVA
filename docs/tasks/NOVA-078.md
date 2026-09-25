# NOVA-078 — Relay: tick recording switch + Archive old ticks

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-078 · **Depends on:** NOVA-075, NOVA-076, NOVA-077

## Goal
On Relay's **Data jobs** page the super-admin turns live tick recording on or off, picks its stocks, sees
whether it is recording, and queues **Archive old ticks**: no Docker command left for daily data work (D54).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D54, `docs/tasks/NOVA-076.md` and `NOVA-077.md` (endpoints, states)
- `frontend/apps/nova-relay/src/pages/data-jobs/{DataJobsPage,NewDownloadPage}.tsx` (from 073)

## Files
Create:
- `frontend/apps/nova-relay/src/pages/data-jobs/{RecorderCard,RecorderSymbolsModal,ArchiveModal}.tsx`
Modify:
- `frontend/packages/services/src/api/relay.ts`, `src/queries/{relay,keys}.ts`, `src/queries/queries.test.tsx`
- `frontend/packages/mocks/src/handlers/relay.ts`
- `frontend/apps/nova-relay/src/pages/data-jobs/{DataJobsPage,dataJobs.test}.tsx`, `src/lib/labels.ts`
- `frontend/apps/nova-relay/src/pages/overview/OverviewPage.tsx`, `overview.test.tsx`
- `docs/guides/USER-GUIDE.md`

## Build
1. Services: `getRecorder`, `updateRecorder`, `createArchiveJob`; hooks `useRecorder` (refetch every 30 s),
   `useUpdateRecorder`, `useCreateArchiveJob` (refreshes data jobs).
2. MSW: recorder GET/PUT kept in memory for the session (demo), archive POST → 201 `queued` job, 400 for a
   future date.
3. `RecorderCard` above the jobs table: switch **Record live prices**, status badge (**Off**, **Waiting for
   market hours**, **Recording**, **Log in to Kite first**), stocks text ("All synced stocks" or "12 stocks")
   with **Choose stocks** (modal: DataTable selection over the stock list, at most 3,000), link to the running job.
   Help text: "Records every weekday 09:15–15:30 while on. Prices before today cannot be recorded later."
4. **Archive old ticks** button → `ArchiveModal`: **Move ticks before** date (default: 30 days ago) with
   "Moves older live prices from the database to files. Nothing is lost." → toast **Archive queued**.
5. Overview: when recording is on and the state is **Log in to Kite first**, the daily login prompt says
   recording is waiting for it.
6. User guide: Step 7 (recording switch, choosing stocks, archiving), remove the Docker-only lines from
   "not there yet", add "Recording says Log in to Kite first" to the "what do I do if" table.

## Acceptance checks
- [ ] Vitest: switch calls the API and shows each state label; Choose stocks saves the selection; archive
      with a future date is blocked; success toasts show; overview prompt appears for `no_login`.
- [ ] Card and modals work at 360px in dark and light.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Schedules for downloads or archives; an NSE holiday calendar; charts of ticks.

## Questions

## Handoff
Built by Claude at the Owner's request. All acceptance checks pass.
- Services: `getRecorder`/`updateRecorder` (PUT), `createArchiveJob` + `useRecorder` (30 s refetch),
  `useUpdateRecorder`, `useCreateArchiveJob`. MSW: recorder kept in memory (`resetMockRecorder` for tests).
- Relay: `RecorderCard` (switch, state badge, stocks, link to the running job), `RecorderSymbolsModal`,
  `ArchiveModal`; Overview `RecorderWaiting` note for `no_login` (own file). Labels in `lib/labels.ts`.
- Plural fixes: "1 chosen stock", "Synced 1 stock" (Instruments page from 075).
- Checks: `pnpm review:check` green (701 tests).
- Guides: USER-GUIDE (Step 2, Step 7, Step 8, not-there-yet, what-do-I-do-if); READMEs, compose comment.

## Review
Self-reviewed. Real-mode check after rebuilding the stack: see the D54 batch summary.
