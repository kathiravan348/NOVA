# NOVA-020 — Relay: rate limits, data jobs, audit log

**Status:** planned · **Owner:** - · **Branch:** task/NOVA-020 · **Depends on:** NOVA-019

## Goal
The last three Relay screens: API rate-limit usage per broker account, the NOVA Atlas data-job queue (list + detail), and a filterable audit log. After this Relay has no placeholder pages.

## Read first
- `AGENTS.md` (§6, §7)
- `frontend/packages/contracts/src/{rateLimit.ts,dataJob.ts,audit.ts}`, `frontend/packages/mocks/data/{rateLimits,dataJobs,auditEntries}.json`
- `frontend/packages/ui-trading/src/components/Meter/Meter.tsx`, `src/format/money.ts` (`formatQuantity`)
- `frontend/apps/nova-relay/src/{routes.tsx,lib/*.ts,components/QueryState.tsx,test/renderApp.tsx,pages/accounts/AccountsPage.tsx}`

## Files
Create in `frontend/apps/nova-relay/src/`:
- `lib/labels.ts`, `lib/labels.test.ts`
- `pages/rate-limits/{RateLimitsPage.tsx,AccountLimitsCard.tsx,rateLimits.test.tsx}`
- `pages/data-jobs/{DataJobsPage.tsx,DataJobDetailPage.tsx,dataJobs.test.tsx}`
- `pages/audit/{AuditPage.tsx,audit.test.tsx}`
Modify: relay `src/routes.tsx`, `src/lib/format.ts`; delete relay `src/pages/PlaceholderPage.tsx`

## Build
1. `lib/labels.ts`: `endpointLabel` (quote "Quotes", historical "Historical data", orders "Orders", other "Other"); `jobTypeLabel` (historical_download "Historical download", tick_record "Tick recording", archive "Archive"); `jobStatusLabel`/`jobStatusTone` (queued neutral, running info, completed success, failed danger, cancelled neutral); `auditActionLabel` for every `AuditAction` ("Signed in", "Kite session expired", …) and `auditGroup(action)` → `auth | broker | strategy | backtest | data_job | settings` (prefix before "."). Tests cover every enum value. `format.ts` gains `formatPeriod` (same as Orbit).
2. `RateLimitsPage`: one `AccountLimitsCard` per account that has limits (title = account label from `useBrokerAccounts`, fallback id; "Updated <IST>" caption). Each endpoint row: name, `Meter` "Peak per second" (`peak`/`limit`, valueText "6 / 10 per sec"), `Meter` "Requests today" (`requestsToday`/`dailyLimit`, valueText with `formatQuantity`) or text "No daily limit" when null, and `Badge` "Throttled N" (warning) when `throttledToday > 0` else "No throttling". Grid: 1 col → 2 from `lg`. Loading / error / empty.
3. `DataJobsPage`: header note "Downloads and recordings run in NOVA Atlas (Stage B)." `DataTable` "Data jobs": Job (type label, link to detail, primary), Status badge, Symbols (first 3 + "+N more"), Timeframe (or "Ticks"), Period (`formatPeriod` or "—"), Progress (`formatPercent` 0 decimals, numeric), Rows (`formatQuantity`, numeric), Created (IST short, numeric; sort desc).
4. `DataJobDetailPage` (`useDataJob` via `QueryState`, back to `/data-jobs`): header (type label, id mono, status badge), `Meter` progress (valueText "45%"), `DescriptionList` (Exchange, Segment, Symbols (all), Timeframe, Period, Rows written, Created, Started, Finished — IST or "—"), failed → `EmptyState tone="error"` with `job.error`; queued/running → secondary `Button` "Cancel job" that shows toast "Demo only" (no mutation).
5. `AuditPage`: filter `Select` "Show" (All activity + one option per group) kept in `?group=`; `DataTable` "Audit log": Time (IST short, numeric, sort desc), Actor, Action (label), Target (`type · id` or "—"), Summary (primary), IP (mono, `hideOnMobile`, "—" when null). Page size 10.
6. Routes: `/rate-limits`, `/data-jobs`, `/data-jobs/:id` (title "Data job"), `/audit`; remove the placeholder helper and file.
7. Tests (`renderApp`): rate limits show both accounts, "3 / 3 per sec" and "Throttled 5" for the secondary account, and "No daily limit"; data jobs list 5 jobs with statuses, detail of `job_004` shows its error, `job_002` cancel shows the demo toast, unknown id → Not found; audit shows 10 rows on page 1, filter "Broker" shows only broker rows and sets `?group=broker`.

## Acceptance checks
- [ ] All screens at 360px and desktop; dark/light; meters have text values (not colour alone).
- [ ] Relay has no placeholder pages left.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Creating/cancelling jobs for real, live rate-limit updates, audit export, date-range filters.

## Questions

## Handoff

## Review
