# NOVA-023 — Contracts: Relay (broker account, rate limit, data job, audit entry)

**Status:** ready-for-review · **Owner:** Gemini · **Branch:** task/NOVA-023 · **Depends on:** NOVA-004

## Goal
`@nova/contracts` also exports Zod schemas and inferred types for broker accounts, rate limits, data jobs and audit entries, so the Relay screens (NOVA-019/020) and mocks (NOVA-005) have a fixed shape.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` (D17), `docs/CONTRACTS.md`
- `frontend/packages/contracts/src/{index.ts,common.ts,backtest.ts,backtest.test.ts}` (follow their style)

## Files
Create in `frontend/packages/contracts/src/`: `broker.ts`, `rateLimit.ts`, `dataJob.ts`, `audit.ts`, and one `*.test.ts` next to each.
Modify: `frontend/packages/contracts/src/index.ts` (re-export the four), `docs/CONTRACTS.md`.

## Shapes (each file exports `XSchema` and `type X = z.infer<typeof XSchema>`; objects use `z.strictObject`; reuse `common.ts`)
- **broker:**
  - `Broker` = `zerodha`. `BrokerSessionStatus` = `active|expired|not_logged_in`.
  - `BrokerSession` {status, loggedInAt: UtcDateTime|null, expiresAt: UtcDateTime|null}. Refine: `not_logged_in` ⇔ both null; otherwise both set and loggedInAt < expiresAt.
  - `BrokerAccount` {id, broker, label (non-empty), clientId (non-empty, e.g. "AB1234"), enabled: boolean, session: BrokerSession, createdAt}. No API key, secret or access token fields — ever.
- **rateLimit:**
  - `RateLimitEndpoint` = `quote|historical|orders|other`.
  - `RateLimit` {accountId, endpoint, limitPerSecond: int > 0, peakPerSecond: int ≥ 0, requestsToday: int ≥ 0, dailyLimit: int > 0 | null, throttledToday: int ≥ 0, updatedAt}. Refine: peakPerSecond ≤ limitPerSecond; if dailyLimit is set, requestsToday ≤ dailyLimit; throttledToday ≤ requestsToday.
- **dataJob:**
  - `DataJobType` = `historical_download|tick_record|archive`. `DataJobStatus` = `queued|running|completed|failed|cancelled`.
  - `DataJob` {id, type, status, exchange, segment, symbols: string[] (min 1), timeframe: Timeframe|null, from: IsoDate|null, to: IsoDate|null, progressPercent (0–100), rowsWritten: int ≥ 0, createdAt, startedAt|null, finishedAt|null, error: string|null}. Refines:
    1. `historical_download` ⇒ timeframe, from, to all set; `tick_record` ⇒ timeframe null.
    2. from and to both null or both set, and from ≤ to.
    3. `error` is set only when status is failed.
    4. `completed` ⇒ progressPercent is 100 and finishedAt set; `queued` ⇒ startedAt and finishedAt null.
- **audit:**
  - `AuditAction` = `auth.login|auth.logout|broker.login|broker.session_expired|strategy.create|strategy.update|backtest.run|data_job.create|data_job.cancel|settings.update`.
  - `AuditTargetType` = `user|broker_account|strategy|backtest|data_job|settings`.
  - `AuditEntry` {id, at: UtcDateTime, actorId: Id|null (null = system), actorName (non-empty), action, targetType: AuditTargetType|null, targetId: Id|null, summary (non-empty), ip: string|null}. Refine: targetType and targetId both null or both set.

## Build
1. Follow `backtest.ts` for refine style (one `.refine` per rule, with a clear `message` and `path`).
2. Tests: each schema accepts one valid inline example and rejects each refinement plus one wrong enum. Inline IPs use documentation ranges only (`203.0.113.x`). No mock files yet.
3. `CONTRACTS.md`: one row per top-level schema (BrokerAccount, RateLimit, DataJob, AuditEntry), Used by = Relay, Mock = `NOVA-005`. Endpoints: `GET /api/v1/broker/accounts`, `GET /api/v1/broker/accounts/{id}`, `GET /api/v1/broker/rate-limits`, `GET /api/v1/data-jobs`, `GET /api/v1/data-jobs/{id}`, `GET /api/v1/audit`.

## Acceptance checks
- [x] `pnpm --filter @nova/contracts test` passes, including the 64 existing tests.
- [x] No `any`, no `z.any()`, no secret/token/apiKey fields. Every file ≤ 300 lines.
- [x] `common.ts`, `package.json` and the Orbit schema files are unchanged.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Mocks, MSW, services, request/mutation shapes (login, cancel job), a Relay "overview" summary schema, and any change to Orbit contracts.

## Questions
_(none)_

## Handoff
**Done:** Added Relay contracts (broker, rateLimit, dataJob, audit) with Zod schemas, types, and unit tests.
**Files changed:**
- `docs/CONTRACTS.md`
- `frontend/packages/contracts/src/index.ts`
- `frontend/packages/contracts/src/broker.ts`
- `frontend/packages/contracts/src/broker.test.ts`
- `frontend/packages/contracts/src/rateLimit.ts`
- `frontend/packages/contracts/src/rateLimit.test.ts`
- `frontend/packages/contracts/src/dataJob.ts`
- `frontend/packages/contracts/src/dataJob.test.ts`
- `frontend/packages/contracts/src/audit.ts`
- `frontend/packages/contracts/src/audit.test.ts`
**Commands run:** lint / typecheck / test / build → all pass? yes (125 tests pass workspace-wide; 112 in contracts)
**Checked:** 360px n/a · desktop n/a · dark n/a · light n/a
**New dependencies:** none
**Maps updated:** CONTRACTS
**Deviations from task:** none
**Known gaps:** none

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
