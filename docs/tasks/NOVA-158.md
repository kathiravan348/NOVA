# NOVA-158 — Recorder: fast restart after an interruption

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-158 · **Depends on:** NOVA-155 (review done)

## Goal
An interrupted recording restarts within seconds, not minutes (D79): short job retries, a failed database save
keeps the ticks instead of ending the recording, and a silent socket is noticed and reconnected.

## Read first
- `AGENTS.md` (§1 live recording rule D76); `docs/DECISIONS.md` row D79
- `backend/services/broker/src/nova_broker/recorder.py`, `recorder_loop.py` and their tests

## Files
Modify:
- `backend/services/broker/src/nova_broker/recorder.py`, test `tests/test_recorder.py`
- `backend/services/broker/src/nova_broker/recorder_loop.py`, test `tests/test_recorder_loop.py`
- `docs/guides/API.md` (row `python -m nova_broker recorder`: one line on restarts)

## Build
1. **Job retry** (`recorder_loop.py`): replace `RETRY_AFTER` (5 min) with `RETRY_STEPS = (10, 30, 60)` seconds.
   Each consecutive failed recording uses the next step (stays at 60). A recording that ran ≥ 5 minutes, or ended
   without error, resets to the first step. `run()` waits until `retry_at` when that is sooner than
   `poll_seconds`, so the 10 s retry really happens after 10 s.
2. **Save failures** (`recorder.py` `_flush`): if `sink` raises, log a warning, keep the buffer and return; the next
   due flush tries again. Never raise out of `_take`, so the socket keeps reading. Cap the buffer at
   `MAX_BUFFER = 50_000` rows: drop the oldest beyond that and log how many were dropped. The final flush in
   `run()` tries once more and, if it still fails, logs the lost row count (the job then ends normally).
3. **Redis** (`recorder_loop.py` sink): `publish_ticks` already skips `RedisError`; catch any other publish error
   there too and log it. It must not count as a failed save (rows are committed; a retry doubles `rows_written`).
4. **Stall watchdog** (`recorder.py` `_session`): read each message with `asyncio.wait_for(…, READ_TIMEOUT=5)`.
   On every message or timeout, check `should_stop()`. If no stock tick (a parsed row, not a heartbeat) arrived
   for `STALL_SECONDS = 60` since connect or the last tick, raise so `run()` reconnects with its existing
   backoff, logging "No ticks for 60 s; reconnecting". Time everything with the injected `now`/`sleep`.

## Acceptance checks
- [ ] Loop: failures retry after 10 s, 30 s, 60 s, 60 s; a 5-minute recording resets it to 10 s; `run()` does not
      wait the full 30 s poll before a 10 s retry.
- [ ] Recorder: a sink that fails twice then works saves every row once; the socket is not reconnected.
- [ ] Recorder: past 50,000 buffered rows the oldest are dropped and the count is logged.
- [ ] Loop: a Redis publish error leaves the job running and `rows_written` correct.
- [ ] Recorder: heartbeats only for 60 s → one reconnect; a socket that sends nothing still checks `should_stop`
      within 5 s.
- [ ] Existing recorder and loop tests pass (update the 5-minute retry test to the new steps).
- [ ] Definition of done in `AGENTS.md` §9 (`docker compose run --rm backend-check` passes).
- [ ] Deploy (D76): rebuild **only** `tick-recorder` with `--no-deps`, after 15:45 IST on a weekday (or any time
      on a weekend). Never during market hours.

## Out of scope
- Any alert (in-app, desktop, Telegram, email, outside health check): not chosen in D79.
- Heartbeat/health endpoints, Relay screen changes, `compose.yaml` changes (memory limit, restart policy).
- Faster start after a Kite login (still the 30 s poll), and changing the 1 → 30 s socket backoff.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
