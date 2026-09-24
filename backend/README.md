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
