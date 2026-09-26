# NOVA-083 — Atlas: remove the CLI commands Relay already covers

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-083 · **Depends on:** NOVA-078

## Goal
`python -m nova_atlas` keeps only `worker` (a process, started by Compose). Syncing instruments, queueing
downloads and archiving ticks are done in Relay only (D55 point 5).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D54, D55
- `backend/services/atlas/src/nova_atlas/cli.py`, `backend/README.md` (commands table), `README.md` (daily steps)

## Files
Modify:
- `backend/services/atlas/src/nova_atlas/cli.py`
- `backend/README.md`, `README.md`, `docs/guides/API.md` (CLI section)
Create:
- `backend/services/atlas/tests/test_cli.py`

## Build
1. `cli.py`: remove `sync-instruments`, `download`, `archive-ticks` and imports only they used; the docstring
   says `python -m nova_atlas worker`. `sync_instruments`, `queue_download`, `archive_ticks` stay (HTTP and
   worker use them).
2. `test_cli.py`: `--help` lists only `worker`; an old command exits with argparse's error (code 2).
3. READMEs: remove the three Atlas rows; point to Relay (**Instruments → Sync with Kite**, **Data jobs →
   New download**, **Data jobs → Archive old ticks**). Leave the broker rows to NOVA-081.
4. `API.md`: the CLI section lists what remains.

## Acceptance checks
- [ ] pytest atlas green; `docker compose run --rm backend-check` green.
- [ ] `docker compose up -d` still starts `atlas-worker`.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Broker CLI (NOVA-081); `create-admin`, `new-token-key`, migrations, backtest `worker` (they stay).

## Questions

## Handoff

## Review
