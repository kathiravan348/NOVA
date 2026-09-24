# NOVA-050 — Broker: rate limiter (Redis), rate-limits GET/PATCH + audit, daily reset setting

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-050 · **Depends on:** NOVA-049

## Goal
Every Kite call the broker makes (from NOVA-051) first takes a slot from a Redis limiter that enforces the NOVA limit
per account × endpoint × window (D27). Relay's rate-limit page gets real data: limits, peak/count used, reset time and
throttled count, and the NOVA limit can be edited (≤ broker limit, audited) (D40).

## Read first
- `AGENTS.md` (§8, §10), `docs/DECISIONS.md` (D27, D35, D39, D40), `docs/PLAN.md` (R3)
- `frontend/packages/contracts/src/rateLimit.ts`, `frontend/packages/mocks/data/rateLimits.json`
- `backend/services/broker/src/nova_broker/{main.py,accounts.py,cli.py,deps.py}`, `nova_db/models/broker.py`

## Files
Create: `nova_broker/{limits.py,limiter.py,limiter.lua,rate_limits.py}`, `services/broker/tests/{test_limiter.py,test_rate_limits.py}`,
`nova_contracts/rate_limit.py` + `tests/test_rate_limit.py`, `nova_testing/redis.py`
Modify: `nova_broker/{main.py,cli.py,settings.py,deps.py}`, `services/broker/tests/conftest.py`, `nova_contracts/__init__.py`,
`backend/pyproject.toml`, `uv.lock`, `compose.yaml` (`backend-check` gets redis), `.env.example`,
`docs/{DECISIONS,CONTRACTS,STRUCTURE}.md`

## Build
1. Pydantic `RateLimitRule` (3 refinements), `RateLimit` (unique windows), `RateLimitUpdate`; parity vs mock.
2. `limits.py`: Kite v3 broker limits (R3). Default NOVA limit = max(1, floor(0.9 × broker)). Rules are created by
   `add-account` and back-filled at start-up for accounts without rules.
3. `limiter.lua` (one atomic call): for each window of the endpoint — second/minute = sorted-set log trimmed to the
   window; day = counter keyed by reset period. If any window is full: deny, add nothing, bump `throttled` (per day),
   return the wait in ms. Else record in every window and raise each window's peak (per day). Time comes from Python.
4. `RateLimiter.acquire(account, endpoint, rules, now) -> Decision(allowed, retry_after_ms)`; `usage(...)` returns
   used per window + throttled. Day period starts at `NOVA_KITE_DAILY_RESET` (IST, default `00:00`, D40).
5. `GET /broker/rate-limits` → `RateLimit[]` (account order, endpoint order); `resetsAt` = next reset (day only).
   `PATCH /broker/rate-limits/{accountId}/{endpoint}` body `RateLimitUpdate` → 204; 404 unknown account/endpoint;
   400 unknown window or above broker limit; audit `broker.rate_limit_update` "orders per day: 4,500 → 4,000".
6. Tests use real Redis (`NOVA_TEST_REDIS_URL`, db 15, flushed per test; skipped when unset, like the DB tests).

## Acceptance checks
- [x] Limiter: second/minute/day limits, denial consumes nothing, rolling window frees slots, day reset at the
      configured IST time, peak + throttled counts. Endpoints: shape (schema), PATCH rules, audit.
- [x] `backend-check` passes. Definition of done in `AGENTS.md` §9.

## Out of scope
- Calling Kite for data (051), Relay real mode (058), per-order modification limits (Phase 3).

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). Lua limiter, default rules, GET/PATCH rate limits, audit.
**Commands run:** `backend-check` pass (163 tests, Redis + DB); e2e through Core: add-account → 4 limits → PATCH
orders/day 4,500 → 4,000 (204) → audit "orders per day: 4,500 → 4,000". Test rows removed.
**New dependencies:** redis 8.1.0 (redis-py).
**Deviations:** `app` and `caller_headers` fixtures added to the broker conftest; `redis_client` in `nova_testing.redis`.
**Known gaps:** the Kite daily reset time is unconfirmed (setting, D40). Nothing calls `acquire` yet: NOVA-051 does.

## Review
**Result:** done
**Fixed directly:** route parameter `_` shadowed by a loop variable (mypy); literal-typed fields built with
`model_validate` instead of `type: ignore`; restart test rewritten to build a fresh app.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
