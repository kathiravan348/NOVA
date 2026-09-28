# NOVA-140 — Automatic broker-unavailable date history in Stored data

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-140 · **Depends on:** NOVA-139

## Goal
Record successful checks that leave internal trading dates without usable candles, show history, skip routine retries and resolve records when prices arrive. No manual verification gate.

## Read first
- Rulebook/agent files; Files below; Atlas broker_client/settings/tokens/universe/jobs; DB paging/models/base; contracts common/page.
- Services api/marketData, queries/marketData, api/relay, queries/relay; existing ui-trading table stories/tests and ui-core Tabs/Card/LoadMore/DataTable APIs.

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0022_unavailable_days.py`
- `backend/services/atlas/src/nova_atlas/unavailable.py`, `backend/services/atlas/tests/test_unavailable.py`
- `backend/libs/nova_contracts/src/nova_contracts/unavailable.py`, `backend/libs/nova_contracts/tests/test_unavailable.py`
- `frontend/packages/contracts/src/{unavailable.ts,unavailable.test.ts}`, generated `schema/UnavailableDay.json`
- `frontend/packages/mocks/data/unavailable.json`
- `frontend/packages/ui-trading/src/components/UnavailableDataTable/{UnavailableDataTable.tsx,UnavailableDataTable.stories.tsx,UnavailableDataTable.test.tsx}`
- `frontend/apps/nova-relay/src/pages/stored-data/UnavailableDataPanel.tsx`
Modify:
- DB `models/{coverage.py,__init__.py}`, `tests/test_migrations.py`; backend contracts `{coverage.py,__init__.py}`.
- Atlas `{candle_days,coverage,download,plan,main}.py`, `tests/{conftest,test_coverage}.py`; broker `tests/conftest.py` (test isolation only).
- Frontend contracts `{coverage.ts,index.ts,jsonSchema.test.ts}`, generated coverage schemas.
- Mocks `{src/data.ts,src/handlers/marketData.ts,src/handlers/marketData.test.ts,data/coverage.json}`.
- Services `{api/marketData.ts,queries/marketData.ts,api/coverage.test.ts}`; ui-trading `src/index.ts`.
- Relay stored-data `{StoredDataPage,MissingDaysModal,coverageGroups}.tsx`, `storedData.test.tsx`; data-jobs `NewDownloadPage.tsx`.
- `docs/{DECISIONS,STRUCTURE,CONTRACTS,COMPONENTS}.md`, `docs/guides/{API,DATABASE,USER-GUIDE}.md`, board and this task.

## Build
1. Migration 0022: unique exchange/symbol/timeframe/IST date, check times/count, broker/reason, last job/check and resolution. Job deletion preserves history.
2. Only successful responses create evidence. Errors, pre-listing dates and unobserved dates do not. Candles resolve records; later missing dates reopen them. Checks are idempotent per committed step.
3. Calendar combines NIFTY 50 and >=10-stock daily dates. Unobserved holidays/weekends are excluded; observed special sessions count. An all-data absence is unknown, not a verified holiday.
4. Skip-existing treats tracked unavailable dates as explained; overwrite rechecks. Missing counts stay visible; incomplete data is never Complete.
5. Paged GET `/market-data/unavailable` with period/timeframe/state/symbol filters; shared table and Stored data tab show exact dates, response, checks, attempts, state and job. Check again prefills an overwrite plan.
6. Seed the current three ranges only after fresh successful broker validation; attach a supporting finished job. Preserve downloads, prices and agent permissions.
7. Update guides/maps; required gates and visual checks; deploy affected services only when downloads idle. Stack on 139, without self-review or merge.

## Acceptance checks
- [x] Successful missing-candle checks persist; broker errors, pre-listing and closed/unobserved dates do not create false evidence.
- [x] Repeat-check idempotence, recovery/reopening, job deletion and skip/overwrite behavior verified.
- [x] Coverage preserves incomplete status and unfinished edges; calendar union/special-session regression passes.
- [x] Pagination, mock/Zod/Pydantic parity, services and UI flow tests; desktop/360px and both themes checked.
- [x] Full backend/frontend gates and live agent pagination pass; downloads preserved.

## Out of scope
Derived prices, vendor switching, verified official holiday catalogue/auto-sync, orders and self-review/merge.

## Handoff
- Migration 0022; deployed Atlas API/worker only after confirming zero active jobs; other services/prices preserved.
- Fresh broker checks returned zero daily bars: AWL 71, FORCEMOT 76, NIFTY 500 1; 148 evidence records with supporting jobs.
- Live agent GET: 3 pages, 148 unique dates. Coverage says unavailable; routine requests 0 / overwrite requests 1 per known range.
- backend-check: 1219 tests, lint/format/mypy passed. frontend review:check: 972 tests, lint/typecheck/format and builds passed.
- Stories verified desktop/360px, dark/light, all states; default accessibility scan: zero violations in both themes.
- Guides/maps updated. Dependencies: none. Official holiday catalogue remains out of scope; all-data missing sessions remain unknown.
- Independent lead review required; branch stacks on NOVA-139. No self-review or merge.

## Review
**Result:** done
**Reviewer / built by:** Claude / ChatGPT. **Self-review:** no.
**Fixed directly (review: commits):**
- A routine (`skip_existing`) download failed forever on gaps already recorded (1d requests span the whole period,
  so every NIFTY 500 update failed on AWL/FORCEMOT/NIFTY 500). Now it fails only on gaps first recorded after the
  job was created; known gaps go to `summary`. Overwrite still fails (Owner choice). Test added.
- `UnavailableDataTable`: raw `<a href>` replaced by `renderJobLink` (StrategyStatsList pattern); Relay passes a router `Link`.
- D70 was outside the decisions table (blank line); joined. API, USER-GUIDE, D70 describe the new rule.
**Change requests:** none. **Noted, not changed:** `calendar()` runs twice per step (~26 ms live), acceptable.
**Guides checked:** API, DATABASE, USER-GUIDE match the diff (fixed as above). **Rulebook issues found:** none.
**Follow-up tasks created:** none. **Deploy:** the live Atlas API/worker still run the pre-review code.
**Gates:** backend-check 1,220 passed (one Core realtime timing flake under load, passed on re-run); review:check passed.
