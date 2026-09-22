# NOVA-005 — Mocks: static JSON per contract + schema and consistency tests

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-005 · **Depends on:** NOVA-004, NOVA-023

## Goal
`@nova/mocks` exports one validated, internally consistent static data set for every contract, so services (NOVA-006) and every screen can show all states. MSW handlers are NOVA-024, not this task.

## Read first
- `AGENTS.md` (§7), `docs/DECISIONS.md` (D17), `docs/CONTRACTS.md`
- `frontend/packages/contracts/src/*.ts` (not the tests), `frontend/packages/contracts/{package.json,vitest.config.ts}`
- `frontend/packages/mocks/{package.json,tsconfig.json,src/index.ts}`

## Files
Create in `frontend/packages/mocks/`:
- `data/`: `user.json`, `strategies.json`, `backtestRuns.json`, `backtestResults.json`, `trades.json`, `brokerAccounts.json`, `rateLimits.json`, `dataJobs.json`, `auditEntries.json`
- `src/data.ts`, `src/schemas.test.ts`, `src/orbit.consistency.test.ts`, `src/relay.consistency.test.ts`, `vitest.config.ts` (copy of contracts')
Modify: `frontend/packages/mocks/{package.json,src/index.ts}`, `docs/CONTRACTS.md`, `docs/STRUCTURE.md`, `frontend/pnpm-lock.yaml` (generated).

## Build
1. `package.json`: add `"test": "vitest run"` and devDependency `vitest` `3.2.7`. No other new dependency (use `XSchema.array()`, not `z`).
2. `src/data.ts`: `export const MOCK_NOW = "2026-09-21T06:30:00Z";` (12:00 IST). Import each JSON and export it parsed: `mockUser` (UserSchema), `mockStrategies`, `mockBacktestRuns`, `mockBacktestResults`, `mockTrades`, `mockBrokerAccounts`, `mockRateLimits`, `mockDataJobs`, `mockAuditEntries` (each `XSchema.array().parse(json)`). `index.ts` re-exports `./data` and keeps `MOCKS_NAME`.
3. Values are typed by hand. Nothing is computed in `src/` (AGENTS §7). IDs are readable: `usr_001`, `stg_001`, `run_001`, `trd_001`, `brk_001`, `job_001`, `aud_001`. Every timestamp is ≤ `MOCK_NOW`, except `session.expiresAt`. No "NOVA" or other brand text. Emails use `example.com`. IPs use `203.0.113.x`. Client IDs are fake (`AB1234`).
4. **Data set (minimum):**
   - 1 user (super_admin). 3 strategies: visual `active` (2 versions, equity_intraday, NSE, 5m), python `draft` (1 version, equity_delivery, 1d), visual `archived` (1 version).
   - 5 runs: `completed` ×2 (stg_001 v1 and v2), `running`, `queued`, `failed` (with `error`). Results only for the 2 completed runs. 4–8 trades per completed run, with at least one `sell` trade and one losing trade.
   - 3 broker accounts, one per session status (`not_logged_in` is also `enabled: false`). Rate limits for each enabled account × all 4 endpoints. 5 data jobs, one per status, covering all 3 types. 10–15 audit entries, newest first, with at least 2 system entries (`actorId: null`).
5. **Orbit rules** (the tests assert each one):
   - Run `strategyVersion` exists in its strategy. queued: started/finished null. running: started set, finished null. completed/failed: both set. createdAt ≤ startedAt ≤ finishedAt.
   - Trades: `runId` is a completed run. exchange/segment match the spec of that run's version. Closed (exit set). Entry < exit, both within run from..to, NSE hours 03:45–10:00 UTC. Intraday trades enter and exit on the same date and have `dpPaise` 0. `grossPnlPaise` = (exit − entry) × qty for buy, (entry − exit) × qty for sell.
   - Metrics per run = its trades: gross, charges (Σ `charges.totalPaise`) and net are sums. tradeCount = trade count. winCount = trades with net > 0, lossCount = trades with net < 0. winRatePercent ≈ win/trades × 100 and returnPercent ≈ net/initial × 100 (`toBeCloseTo(x, 2)`).
   - Equity curve: 10–30 points, dates strictly ascending. First point = run `from` with equity = initial capital. Last point = run `to` with equity = initial + net. `benchmarkPaise` is set on every point iff the run has a benchmark, and the first benchmark value = initial capital.
6. **Relay rules:** `active` sessions have expiresAt > MOCK_NOW, `expired` sessions expiresAt ≤ MOCK_NOW. Each rate limit's `accountId` is an enabled account, and (accountId, endpoint) pairs are unique. Data jobs: createdAt ≤ startedAt ≤ finishedAt when set, and a completed job has rowsWritten > 0. Audit: `actorId` is null (actorName `System`) or the user's id (actorName = user name). `targetId` resolves to a mock of its `targetType` (`settings` is exempt).
7. **All files:** ids are unique per collection. Every enum listed in step 4 appears at least once (test it).
8. Docs: in `CONTRACTS.md`, Mock file = `data/<file>.json` for every row (Charges = `trades.json`, inside each trade). In `STRUCTURE.md`, add `data/` under `mocks/`.

## Acceptance checks
- [x] `pnpm --filter @nova/mocks test` passes. Every rule in steps 5–7 has its own `it(...)`.
- [x] Root `pnpm test` also runs the mocks tests. Contract tests are unchanged and pass.
- [x] No file in `packages/contracts/` changes. Every file ≤ 300 lines. No `any`.
- [x] Definition of done in `AGENTS.md` §9 (stories n/a).

## Out of scope
- MSW, handlers and service worker (NOVA-024). Services and hooks (NOVA-006). Market-data candles. Changing any contract. If a rule seems to conflict with a contract, stop and write it in Questions.

## Questions
_(none)_

## Handoff
- **Done:** Created static mock datasets for all contracts in `@nova/mocks` with schema validation and Orbit/Relay consistency tests.
- **Files changed:** `frontend/packages/mocks/data/*.json`, `frontend/packages/mocks/src/{data.ts,index.ts,schemas.test.ts,orbit.consistency.test.ts,relay.consistency.test.ts}`, `frontend/packages/mocks/{package.json,vitest.config.ts}`, `frontend/pnpm-lock.yaml`, `docs/CONTRACTS.md`, `docs/STRUCTURE.md`, `docs/tasks/BOARD.md`, `docs/tasks/NOVA-005.md`.
- **Commands run:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check` → all pass: yes.
- **Checked:** 360px n/a · desktop n/a · dark n/a · light n/a (non-UI data/mocks package).
- **New dependencies:** `vitest@3.2.7` added to `@nova/mocks` devDependencies.
- **Maps updated:** STRUCTURE, CONTRACTS.
- **Deviations from task:** none.
- **Known gaps:** none.

## Review
**Result:** done
**Fixed directly (review: commits):**
- `backtestResults.json`: removed weekend points from both equity curves (NSE is closed; charts showed flat weekend segments).
- `backtestRuns.json`: run_002 `from` 2026-08-16 (Sunday) → 2026-08-14 (Friday); first curve point moved to match.
- `backtestResults.json`: `maxDrawdownPercent` −1.15 / −0.95 → −0.11 (both curves only drop ~0.106%). `cagrPercent` 12.8 / 11.4 → 13.87 / 10.39 (return annualised over calendar days).
- `orbit.consistency.test.ts`: new tests: run, trade and curve dates are weekdays; drawdown = deepest drop in the curve.
**Change requests (if sent back):** none.
**Rulebook issues found:** none.
**Follow-up tasks created:** none.
