# NOVA backend

Python 3.12, uv workspace: `libs/*` (shared) and `services/*` (one package per service). Rules: `AGENTS.md` §5, §5a, §8.

## First time
```bash
cp .env.example .env          # repo root; change the password
docker compose build
```

## Everyday (repo root)
| Command | Does |
| --- | --- |
| `docker compose up -d` | db (TimescaleDB), redis, `migrate` (runs once), core on http://127.0.0.1:8000/api/v1/health |
| `docker compose run --rm migrate python -m nova_db check` | models vs database: exit 1 on drift |
| `docker compose run --rm backend-check` | ruff, format check, mypy strict, pytest (the gate) |
| `docker compose exec core python -m nova_core create-admin --email you@example.com --name "You"` | create the super-admin (asks for the password) |
| `docker compose exec broker python -m nova_broker add-account --label "Main" --client-id AB1234` | add a Zerodha account |
| `docker compose run --rm broker python -m nova_broker new-token-key` | a value for `NOVA_BROKER_TOKEN_KEY` |
| `docker compose exec atlas python -m nova_atlas sync-instruments` | instruments from the stock list (`universe` table) + Kite (needs a Kite login) |
| `docker compose exec atlas python -m nova_atlas download --symbols INFY,TCS --timeframe 1d --from 2025-01-01 --to 2025-12-31` | queue a candle download |
| `docker compose --profile market up -d tick-recorder` | record live ticks until 15:30 IST (needs a Kite login and synced instruments; add `--symbols` via `run` to limit) |
| `docker compose exec atlas-worker python -m nova_atlas archive-ticks --before 2026-09-01` | move older ticks to Parquet in the `tick-archive` volume |
| `NOVA_API_DOCS=true` in `.env`, then `docker compose up -d` | Swagger UI on http://127.0.0.1:8000/api/v1/docs (D50, dev only); sign in with `POST /api/v1/auth/login` there, then "Try it out" uses the session cookie |
| `docker compose down` | stop everything (data stays in the `db-data` volume) |
| `docker compose build` | rebuild the image after `uv.lock` changes |

## Fast host checks (D36, in `backend/`)
| Command | Does |
| --- | --- |
| `uv sync` | create `.venv` with Python 3.12 from `.python-version` |
| `uv run pytest services/core` | tests for one package |
| `uv run mypy services/core` | types for one package |
| `uv add --bounds exact --package nova-core <dep>` | add a pinned dependency |
| `sh scripts/check.sh` | everything backend-check runs (DB tests skip without `NOVA_TEST_DATABASE_URL`) |
