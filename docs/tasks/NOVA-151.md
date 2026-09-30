# NOVA-151 — Live feed: `live.tick` message + snapshot and per-day summary endpoints

**Status:** ready-for-review · **Owner:** ChatGPT · **Branch:** task/NOVA-151 · **Depends on:** —

## Goal
The backend and contracts behind the Live module (D74 (1)–(2)): a `live.tick` WebSocket message, a latest-price
snapshot, and a per-stock per-day summary of ticks, 1-second candles and missing seconds. No screens yet.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` rows D11, D49, D54, D57, D74
- `backend/services/broker/src/nova_broker/{recorder_loop.py,recorder.py,ticks.py}`, `backend/services/core/src/nova_core/realtime.py`
- `backend/services/atlas/src/nova_atlas/{archive.py,market_data.py}`, `frontend/packages/services/src/realtime.ts`

## Files
Create:
- `backend/services/atlas/src/nova_atlas/live.py` (+ `tests/test_live.py`): snapshot + day summary routes
- `frontend/packages/contracts/src/live.ts` (+ test): `LiveTick`, `LiveSnapshotItem`, `LiveDaySummary`; `frontend/packages/mocks/data/live*.json`, `src/handlers/live.ts` (+ test)
- `frontend/packages/services/src/{api/live.ts,queries/live.ts}`
Modify:
- `backend/services/broker/src/nova_broker/recorder_loop.py` (+ tests): the sink also publishes each tick to Redis pub/sub `nova:ticks`
- `backend/services/core/src/nova_core/realtime.py` (+ tests): subscribes, sends `live.tick` at most 1 per stock per second
- `backend/libs/nova_contracts` (Pydantic mirrors + parity), `schema/*.json`, `backend/services/atlas/src/nova_atlas/main.py` (router)
- `frontend/packages/services/src/realtime.ts` (+ test): `live.tick` handler API; `docs/{CONTRACTS.md,STRUCTURE.md}`
- `docs/guides/{API.md,DATABASE.md}` (Redis key/channel), `docs/tasks/{BOARD.md,NOVA-151.md}`

## Build
1. `live.tick`: `{symbol, price (paise), changePercent, at, ticksThisSecond}`. A client subscribes with `{type:"live.subscribe", symbols:[…]}` (max 500); unsubscribed sockets get none.
2. `GET /api/v1/live/snapshot?symbols=…`: last price, change vs previous close, last tick time, seconds with a tick today, seconds expected so far (09:15–now, IST).
3. `GET /api/v1/live/days?symbol=…`: per day: tick count, 1-second candle count, missing seconds, `noTrade` seconds, size in bytes.
   Missing second = inside 09:15–15:30 with no tick; it is a **recorder fault** only if other recorded stocks had ticks that second, else **no trade** (D74).
4. Read from `ticks` (today) and the Parquet archive (older days, D49); never call Kite (D35).
5. Mocks: 8 stocks with plausible numbers, one with gaps.

## Acceptance checks
- [x] Backend tests: gap classification (fault vs no trade), throttle to 1/s, unsubscribed socket gets nothing.
- [x] Parity tests pass; mocks validate; endpoints in `API.md`.
- [x] Definition of done in `AGENTS.md` §9 (`review:check` and `backend-check`).

## Out of scope
- Screens (NOVA-152/153); building stored 1-second candles (computed on read); orders; option or index ticks.

## Questions
None.

## Handoff
**Done:** committed ticks publish to Redis; selected stocks stream at most once a second; Atlas serves snapshots and computed daily tick/candle/fault/no-trade/size summaries.
**Files changed:** `backend/libs/nova_contracts/`, `backend/services/{atlas,broker,core}/`, `backend/uv.lock`, `frontend/packages/{contracts,mocks,services}/`, `docs/{CONTRACTS,STRUCTURE}.md`, `docs/guides/{API,DATABASE}.md`, `docs/tasks/{BOARD,NOVA-151}.md`.
**Commands run:** `schema:update`, targeted frontend/backend tests, `pnpm review:check` (1,046 tests + builds pass), `docker compose run --rm backend-check` (1,315 tests, ruff/format/mypy pass).
**Checked:** 500-stock socket burst and snapshot; subscription filtering/cleanup/reconnect; Redis outage storage; database/Parquet gaps and snapshots; ampersand/hyphenated symbols. Screens/stories: not applicable.
**New dependencies:** no new library; Core directly declares existing `redis==8.1.0`, locked with `uv add`.
**Maps updated:** CONTRACTS / STRUCTURE; COMPONENTS unchanged.
**Guides updated:** API / DATABASE; USER-GUIDE unchanged (no screens).
**Deviations from task:** supporting helper modules, broker CLI wiring, Core lifecycle/gateway registration and explicit blocked agent rule are required to connect the recorder and public endpoints; no new migration or stored second candles.
**Known limits:** archived gap classification reads timestamp columns from all recorded stocks per day in bounded batches; `changePercent` uses the last stored daily close before the tick's IST date, or null if unavailable.

## Review
_(reviewer — see `docs/templates/REVIEW.md`)_
