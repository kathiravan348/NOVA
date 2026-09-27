# NOVA-123 — Stored data: contracts, mocks, MSW, services (D63)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-123 · **Depends on:** —

## Goal
The wire types for D63 (3) exist on both sides with parity, with static mocks, MSW handlers and TanStack Query hooks. The
Atlas endpoints (NOVA-124) and the Relay page (NOVA-126) can then be built in parallel.

## Read first
- `AGENTS.md` §7; `docs/DECISIONS.md` D34, D58, D63; `docs/CONTRACTS.md`; every file under Files

## Files
Create:
- `frontend/packages/contracts/src/coverage.ts` (+ `.test.ts`), `backend/libs/nova_contracts/src/nova_contracts/coverage.py`
- `backend/libs/nova_contracts/tests/test_coverage.py`, `frontend/packages/mocks/data/coverage.json`
Modify:
- `frontend/packages/contracts/src/index.ts`, `schema/*.json` (`pnpm --filter @nova/contracts schema:update`)
- `backend/libs/nova_contracts/src/nova_contracts/__init__.py`
- `frontend/packages/mocks/src/handlers/{marketData,marketData.test}.ts`, `frontend/packages/mocks/src/{schemas.test,marketData.consistency.test}.ts`
- `frontend/packages/services/src/{api,queries}/marketData.ts`, `frontend/packages/services/src/queries/keys.ts`
  (service tests go in a new `frontend/packages/services/src/api/coverage.test.ts`, because NOVA-112 edits `api.test.ts`)
- `docs/CONTRACTS.md`

## Build
1. `coverage.ts`:
   - `CoverageStatus = "complete" | "gaps" | "partial" | "none"`
   - `CoverageRow {symbol, name, kind: "stock"|"index", sector, indices: IndexName[], firstDay: IsoDate|null, lastDay: IsoDate|null, days: int ≥ 0, missingDays: int ≥ 0, status}`.
     `firstDay`/`lastDay` are the stock's whole stored range. `days`, `missingDays` and `status` count only inside the asked period.
     Refinements: `status = "none"` ⇔ `days = 0` ⇔ both days null; `status = "complete"` ⇒ `missingDays = 0`.
   - `CoverageList {timeframe: "1m"|"1d", from, to, calendar: "index"|"stocks", rows: CoverageRow[]}`, where `calendar` says
     where the trading days came from (D63 (2)).
   - `MissingRange {from, to, days: int ≥ 1}`
   - `CoverageDetail {symbol, timeframe, from, to, firstDay, lastDay, days, missingDays, missing: MissingRange[]}`, with the
     rule that the sum of `missing.days` = `missingDays`.
2. Backend mirror with parity tests (D34).
3. `coverage.json`: 1d and 1m lists for the 24 mock instruments, consistent with `instruments.json` (same symbols, sectors,
   indices). Include at least one row of each status and one index row (NIFTY 50), plus a detail for two symbols with gaps.
   Consistency test: per list, the status rules hold, and each detail matches its row.
4. MSW:
   - `GET /market-data/coverage?timeframe&from&to` returns the mock list for the timeframe, echoing `from`/`to`.
   - `GET /market-data/coverage/:symbol` returns the detail, or 404.
   - Handler tests.
5. Services: `getCoverage({timeframe, from, to})` and `getCoverageDetail(symbol, {timeframe, from, to})`, plus hooks
   `useCoverage` / `useCoverageDetail` with keys under `marketData.coverage`. The list refetches when a data job finishes:
   reuse the realtime invalidation of data jobs (D57) if there is a hook for it; else a 60 s stale time.

## Acceptance checks
- [ ] Zod/Pydantic parity for every coverage type; schema JSON updated.
- [ ] Refinements reject: `none` with days > 0, `complete` with missing days, a detail whose ranges do not add up.
- [ ] Handlers and services are tested; the mocks' consistency test passes.
- [ ] `backend-check` and `pnpm review:check` pass. Guides: none (no endpoint or screen is live yet).

## Out of scope
- Atlas endpoints, the table and the migration (NOVA-124); the Relay page (NOVA-126); DataTable grouping (NOVA-125).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
