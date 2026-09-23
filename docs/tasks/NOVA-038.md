# NOVA-038 — Relay contracts: RateLimit v2, BrokerProfile, session expiry fix

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-038 · **Depends on:** NOVA-023

## Goal
Contracts, mocks, handlers and services describe broker limits per window with a broker limit, an
editable NOVA limit and reset time (D27), plus a broker profile with useful links (D28). Screens
change only enough to compile; the real redesign is NOVA-039/040.

## Read first
- `AGENTS.md` (§7), `docs/PLAN.md` (Review round 1, R3 and R4), `docs/DECISIONS.md` (D17, D21, D22, D27, D28)
- The files listed below

## Files
Modify: contracts `src/{rateLimit.ts,rateLimit.test.ts,broker.ts,broker.test.ts}`; mocks `data/{rateLimits.json,brokerAccounts.json,auditEntries.json}`,
`src/{data.ts,relay.consistency.test.ts,schemas.test.ts}`, `src/handlers/{relay.ts,relay.test.ts,scenarios.ts}`;
services `src/api/{relay.ts,api.test.ts}`, `src/queries/{relay.ts,keys.ts,queries.test.tsx}`, `src/index.ts`;
relay `src/pages/rate-limits/{AccountLimitsCard.tsx,rateLimits.test.tsx}`; `docs/CONTRACTS.md`
Create: mocks `data/brokerProfiles.json`

## Build
1. `RateLimitWindowSchema = enum("second","minute","day")`. `RateLimitRuleSchema { window, brokerLimit: int>0,
   novaLimit: int>0, used: int≥0, resetsAt: UtcDateTime|null }`; refines `novaLimit ≤ brokerLimit`, `used ≤ brokerLimit`,
   `resetsAt` set only for `day`. `used` = peak for second/minute, count so far for day (doc comment).
   `RateLimitSchema { accountId, endpoint, rules: Rule[] (min 1, unique window), throttledToday, updatedAt }`.
   `RateLimitUpdateSchema { window, novaLimit: int>0 }` (request body for edits).
2. `BrokerProfileSchema { broker, name, api, plan, subscriptionRenewsOn: IsoDate|null, apiKeyLast4: /^[A-Za-z0-9]{4}$/,
   redirectUrl: url, postbackUrl: url|null, staticIp: IPv4 string|null, sessionRule: string,
   links: { label, url (https only), kind: enum(docs, rate_limits, console, forum, charges, client_library, other) }[] }`.
3. Mocks: per account, Kite v3 values from PLAN R3 (quote 1/s; historical 3/s; orders 10/s, 400/min, 5000/day;
   other 10/s). NOVA limits ≈ 80% rounded down, never 0 (quote stays 1). Day rule `resetsAt` = next 00:00 IST
   (`2026-09-21T18:30:00Z`). One account near its NOVA limit (> 80%) for warnings. `brokerProfiles.json`: one Zerodha
   profile, links from PLAN R4: https://kite.trade/docs/connect/v3/, https://kite.trade/docs/connect/v3/exceptions/#api-rate-limit,
   https://developers.kite.trade/, https://kite.trade/forum/, https://zerodha.com/charges, https://github.com/zerodha/pykiteconnect.
   Session `expiresAt` = 06:00 IST the day after `loggedInAt` (`…T00:30:00Z`); move the matching
   `broker.session_expired` audit entry to the same time (keep audit order valid).
4. Handlers: `GET /broker/profiles` (list), `GET /broker/profiles/{broker}` (404 unknown), `PATCH
   /broker/rate-limits/{accountId}/{endpoint}` validates body with `RateLimitUpdateSchema` and `novaLimit ≤ brokerLimit`
   → 204, else 400 `ApiError` `invalid_request`; unknown account/endpoint → 404. Add GETs to empty/error scenarios.
5. Services: `listBrokerProfiles`, `getBrokerProfile`, `updateRateLimit(accountId, endpoint, body)`; hooks
   `useBrokerProfiles`, `useBrokerProfile`, `useUpdateRateLimit` (mutation, invalidates rate limits). Tests.
6. `AccountLimitsCard`: minimal change — one `Meter` per rule ("Per second/minute/day", `used / novaLimit`), no new UI.

## Acceptance checks
- [ ] Schema, consistency, handler and service tests pass; `/rate-limits` renders with the new data.
- [ ] No full API key, secret or token anywhere in mocks.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Rate-limits page redesign, edit modal, warnings (NOVA-039); broker page and account detail (NOVA-040).

## Questions

## Handoff

## Review
