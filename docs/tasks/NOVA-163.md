# NOVA-163 — Recorder: record 09:14–15:31 and reconnect a silent feed after 10 s

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-163 · **Depends on:** —

## Goal
The recorder connects before the open and stops after the close (09:14–15:31 IST), and inside the session a feed
with no stock tick for 10 s is reconnected, not after 60 s (D81 items 2–3).

## Read first
- `AGENTS.md` (§1 live recording rule D76); `docs/DECISIONS.md` rows D79, D81
- `backend/services/broker/src/nova_broker/{recorder.py,recorder_loop.py}` and their tests

## Files
Modify:
- `backend/services/broker/src/nova_broker/recorder_loop.py`, test `tests/test_recorder_loop.py`
- `backend/services/broker/src/nova_broker/recorder.py`, test `tests/test_recorder.py`
- `docs/guides/API.md` (row `python -m nova_broker recorder`), `docs/guides/USER-GUIDE.md` (Live → Config: records 09:14–15:31)

## Build
1. `recorder_loop.py`: add `RECORD_START = time(9, 14)`, `RECORD_END = time(15, 31)` and
   `in_recording_window(now)` (weekday, `RECORD_START <= t < RECORD_END`). Use it in `step()` and in
   `_record`'s `should_stop` instead of `in_market_hours`; remove `in_market_hours` if nothing else uses it.
   `MARKET_OPEN`/`MARKET_CLOSE` and `session_progress` (09:15–15:30) stay as they are.
2. `recorder.py`: replace `STALL_SECONDS = 60` with `SESSION_STALL_SECONDS = 10.0` and
   `IDLE_STALL_SECONDS = 60.0`, and add `stall_limit(now) -> float`: 10 when `now` is a weekday 09:15:00–15:29:59
   IST, else 60 (own IST constants; do not import `recorder_loop`, which imports this module). `_session` uses
   `stall_limit(self.now())`; the log/exception text names the limit used ("no ticks for 10 s").
3. `READ_TIMEOUT_SECONDS` 5 → 2, so a silent socket is noticed within about 12 s.
4. Keep everything else from D79 (backoff 1 → 30 s and its reset, buffer, retries).

## Acceptance checks
- [ ] Loop: at 09:14:00 IST on a weekday a recording starts; at 09:13:59 and at 15:31:00 it does not; a recording
      stops when the clock passes 15:31; weekends never record.
- [ ] Recorder: inside the session, heartbeats only for 10 s → one reconnect with "no ticks for 10 s"; at 09:14:30
      heartbeats for 30 s → no reconnect (60 s limit); a silent socket checks `should_stop` within 2 s.
- [ ] `stall_limit` unit test at 09:14:59, 09:15:00, 15:29:59, 15:30:00 IST and on a Saturday.
- [ ] Existing recorder and loop tests pass (update those that assumed 09:15–15:30 or 60 s).
- [ ] Definition of done in `AGENTS.md` §9 (`docker compose run --rm backend-check`).
- [ ] Deploy (D76): `docker compose up -d --build --no-deps tick-recorder` only, after 15:45 IST on a weekday
      or at a weekend. Never during 09:00–15:45 on a weekday.

## Out of scope
- The 30 s settings poll, Kite login timing, Relay screens, `compose.yaml`, alerts.
- Live summaries, gaps and `/live` reads (they keep the 09:15–15:30 session).
- Fixing the PC clock (Owner action) or correcting `received_at` with `exchange_ts`.

## Questions
_(implementer writes here if blocked)_

## Handoff
- Built by Claude, 3 Oct 2026. `recorder_loop.in_recording_window` (weekdays 09:14–15:31 IST) drives `step()` and
  `should_stop`; `in_market_hours` stays because `recorder_settings` uses it for the `no_login` state.
- `recorder.stall_limit(now)`: 10 s inside 09:15–15:30 IST, else 60 s (own IST constants); message names the limit.
  `READ_TIMEOUT_SECONDS` 5 → 2.
- Tests: window edges (09:13:59 / 09:14 / 15:30:59 / 15:31, Saturday), a recording starts at 09:14, stops at 15:31;
  10 s stall in session, no reconnect for 30 s at 09:14, 60 s on a Saturday, `stall_limit` edges.
- backend-check: 1,343/1,344; `core/test_agent_gateway.py::test_agent_local_access` failed once with a
  `CancelledError` and passes alone (41/41): flaky, unrelated.
- Guides: API (recorder row), USER-GUIDE (Live → Config).

## Review
Self-review: yes (Owner allowed self-review on 3 Oct 2026). Matches the task; D79 backoff/buffer untouched.
Deployed Saturday 3 Oct 2026 (market closed): `docker compose up -d --build --no-deps tick-recorder`. Verdict: done.
