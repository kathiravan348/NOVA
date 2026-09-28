# NOVA-139 — Validate download coverage and do not skip small gaps

**Status:** ready-for-review · **Owner:** ChatGPT · **Branch:** task/NOVA-139 · **Depends on:** NOVA-124, NOVA-128

## Goal
Download missing retries every known missing trading day, and finished requests with remaining internal gaps fail with an honest explanation instead of reporting Completed.

## Read first
- `AGENTS.md`, `CHATGPT.md`, `GEMINI.md`; every file under Files.
- Atlas `settings.py`, `tokens.py`, `broker_client.py`, `tests/conftest.py`; `nova_testing/broker.py`.

## Files
Create:
- `backend/services/atlas/tests/test_download_validation.py`
Modify:
- `backend/services/atlas/src/nova_atlas/{candle_days,coverage,plan,download}.py`
- `backend/services/atlas/tests/{test_plan,test_download,test_coverage}.py`
- `docs/guides/{USER-GUIDE,API}.md`
- `docs/tasks/BOARD.md`, this task file.

## Build
1. Share the existing observed trading calendar between coverage, planning and download validation.
2. Skip-existing must not skip an observed trading day absent from the symbol's stored days, even a one-day gap.
3. After requests finish, check known internal missing days inside the requested range. Preserve saved candles; fail with symbols/counts and explain that the broker returned no usable candles for those dates.
4. Validate Owner data through the agent login in `.env.agent`; use only the broker service for upstream reads. Preserve active downloads and credentials.
5. Update guides for the new failure explanation. Do not describe unmerged changes as deployed.

## Acceptance checks
- [x] Tests: one-day internal hole is not skipped; observed exchange holidays are not holes.
- [x] Tests: a successful response missing an internal day fails, saved candles remain, and a targeted empty retry also fails.
- [x] Tests: complete downloads, later listings and gaps outside the requested period stay valid.
- [x] `docker compose run --rm backend-check`; `pnpm review:check` before ready-for-review.
- [x] Live agent coverage and broker-response findings recorded without secrets.

## Out of scope
- Inventing candles, replacing official daily closes with minute-derived closes, other data providers, schema/contract changes, orders.
- Merge/self-review; deployment that interrupts an active download.

## Questions
- Owner chose official daily bars only; keep unavailable dates visible.

## Handoff
Implemented and deployed to Atlas API + worker after checking zero active/queued/paused worker jobs.
- Shared observed calendar; planner retries one-day gaps; worker fails when requested internal gaps remain.
- Existing prices/steps stay saved. 100% refers to finished requests; failed coverage remains Failed.
- Six regression cases cover small holes, holidays, empty retries, incomplete responses, clipping and later listings.
- Gates: backend-check (ruff/format/mypy + 1,210 tests); frontend review:check (964 tests + builds) passed.
- Agent login from `.env.agent` works. No credentials were printed or committed; no approvals bypassed.
- Live source check: AWL 2022-05-05–2022-08-12 (71 days), FORCEMOT 2023-10-26–2024-02-13 (76), NIFTY 500 2020-01-07 (1).
- Broker daily history returned zero candles for each full missing range; neighbouring stock dates returned candles.
- Minute samples exist for AWL/NIFTY 500; sampled minute/5m/1h FORCEMOT history is absent. Owner chose official daily only.
- Actual daily candles vs summaries: zero mismatches. Live validator: 71/76/1; NIFTY 500 skip-existing plan requests=1, skipped=1.
- Unavailable official bars remain Gaps; source repair requires the provider. Historical completed jobs are unchanged.
- Guides: API, USER-GUIDE. Maps unchanged (existing module responsibilities); no dependencies/migration/frontend change.
- Independent review/merge pending; no self-review or merge performed. The live stack is kept running at Owner's request.

## Review
Pending independent lead review.
