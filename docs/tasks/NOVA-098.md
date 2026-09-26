# NOVA-098 — Postgres connections: limit 100, small pools per service

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-098 · **Depends on:** —

## Goal
The stack never runs out of database connections. Today TimescaleDB's tuner set `max_connections = 25`
and ten app processes keep idle pooled connections, so every new request fails ("too many clients",
seen 26 Sep 2026 in Orbit and in `backend-check`).

## Read first
- `AGENTS.md` §5a (Docker rules), `compose.yaml` (`db`), `backend/libs/nova_db/src/nova_db/engine.py`

## Files
Modify:
- `compose.yaml` (`db`: `command: ["postgres", "-c", "max_connections=100"]`)
- `backend/libs/nova_db/src/nova_db/engine.py` (`pool_size=2`, `max_overflow=6`)
Create:
- `backend/libs/nova_db/tests/test_engine.py`
- Modify `docs/guides/DATABASE.md` (§6: connection limit and pools)

## Build
1. `db` starts with `max_connections=100` (the command-line flag wins over the tuned `postgresql.conf`).
2. Every service engine keeps at most 2 idle connections and opens at most 8: 10 processes ≤ 80, leaving
   room for Core's `LISTEN` connection, `backend-check` and psql.

## Acceptance checks
- [ ] `SHOW max_connections` = 100 after `docker compose up -d`.
- [ ] pytest: `create_db_engine` pool size 2, overflow 6.
- [ ] Owner stack: Orbit loads; idle connections ≤ 20.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- PgBouncer. Changing Docker Desktop / WSL limits (Owner only).

## Questions

## Handoff
**Done:** `db` runs with `max_connections=100`; engines use `pool_size=2`, `max_overflow=6`.
**Commands run:** backend-check with the app stack running (662 passed; before, it needed the stack stopped).
**Owner stack:** `SHOW max_connections` = 100; 13 connections after start. **Guides updated:** DATABASE.

## Review
**Result:** done (Claude, Owner request). **Rulebook issues found:** none.
