# NOVA

**Networked Order & Value Analytics**: a private trading platform for one family.

> **Status: Stage B (real backend).** The apps run on static mocks by default (`pnpm review`) or against the
> backend in real mode (`dev:real`). Backtesting only: no orders. See [`docs/PLAN.md`](docs/PLAN.md).

## Apps

| App            | What it does                                                                          | Dev URL               |
| -------------- | ------------------------------------------------------------------------------------- | --------------------- |
| **NOVA Orbit** | Strategy builder (visual rules or Python), backtests, run comparison, market data     | http://localhost:3000 |
| **NOVA Relay** | Broker (Zerodha) accounts and daily Kite login, API rate limits, data jobs, audit log | http://localhost:3001 |
| **Storybook**  | Every shared UI component, in both themes and at phone/tablet/desktop widths          | http://localhost:6006 |

## How to run

Prerequisites (Windows, via winget): fnm with Node 24 (`fnm install 24`), pnpm 12 (`winget install pnpm.pnpm`),
and for the backend Docker Desktop (WSL2) and uv (`winget install astral-sh.uv`). Use pnpm and uv only (no npm, no pip).

There are two ways to run NOVA:

| Mode          | Backend needed? | Sign-in                             | Use it for                          |
| ------------- | --------------- | ----------------------------------- | ----------------------------------- |
| **Mock mode** | No              | Any username and password (demo)    | Looking at screens, UI work, review |
| **Real mode** | Yes (Docker)    | Your super-admin email and password | Real data, backtests, Kite login    |

### Option A: UI only (mock mode)

```bash
cd frontend
pnpm install
pnpm review
```

This starts Orbit (http://localhost:3000), Relay (http://localhost:3001) and Storybook (http://localhost:6006).
The data comes from static mocks. For a guided tour see [`docs/REVIEW-GUIDE.md`](docs/REVIEW-GUIDE.md).

### Option B: backend + UI (real mode)

**1. Start the backend (repo root, Docker Desktop running)**

```bash
cp .env.example .env              # first time only: then change the password and NOVA_INTERNAL_TOKEN
docker compose build              # first time, and again after backend dependency changes
docker compose up -d              # start the stack
```

Check it: http://127.0.0.1:8000/api/v1/health should answer.

**2. Create your sign-in (first time only)**

```bash
docker compose exec core python -m nova_core create-admin --email you@example.com --name "You"
```

It asks for a password. This is the email and password you sign in with.

**3. Start the UI against the backend (two terminals, in `frontend/`)**

```bash
pnpm --filter nova-orbit dev:real    # Orbit  → http://localhost:3000
pnpm --filter nova-relay dev:real    # Relay  → http://localhost:3001
```

The apps send `/api` to NOVA Core on port 8000 (D48). Set `NOVA_API_URL` to point them somewhere else.

**Stop:** `Ctrl+C` in the UI terminals, then `docker compose down` in the repo root. Your data stays in the
Docker volumes (`db-data`, `tick-archive`). Only `docker compose down -v` deletes it.

### Backend containers (Docker Desktop → `nova`)

| Container              | What it does                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `nova-postgres`        | Database (PostgreSQL + TimescaleDB), port 5432                                        |
| `nova-redis`           | Cache and rate-limit counters, port 6379                                              |
| `nova-db-migrate`      | Updates the database tables, then stops. **`Exited (0)` is normal**                   |
| `nova-core-api`        | NOVA Core: the only API the apps talk to, port 8000                                   |
| `nova-broker-kite`     | The only service that talks to Zerodha Kite                                           |
| `nova-strategy-api`    | Strategies and versions                                                               |
| `nova-backtest-api`    | Backtest runs and results                                                             |
| `nova-backtest-worker` | Runs queued backtests                                                                 |
| `nova-atlas-api`       | Market data and data jobs                                                             |
| `nova-atlas-worker`    | Runs data jobs (candle downloads, tick archive)                                       |
| `nova-tick-recorder`   | Live ticks on market days only: `docker compose --profile market up -d tick-recorder` |

### Backend commands (repo root)

| Command                                 | Does                                                                 |
| --------------------------------------- | -------------------------------------------------------------------- |
| `docker compose ps`                     | Show container status                                                |
| `docker compose logs -f core`           | Follow the logs of one service (`core`, `broker`, `atlas-worker`, …) |
| `docker compose restart core`           | Restart one service                                                  |
| `docker compose up -d --build`          | Rebuild the image and restart after code changes                     |
| `docker compose run --rm backend-check` | All backend checks: lint, types, tests                               |
| `docker compose down`                   | Stop everything (data is kept)                                       |

`docker compose` commands use the **service** name (`core`, `db`, `broker`); Docker Desktop shows the
**container** name (`nova-core-api`, `nova-postgres`, `nova-broker-kite`). More commands (Kite accounts,
instrument sync, downloads, Swagger UI): [`backend/README.md`](backend/README.md).

What is built today, kept up to date with every task: [user guide](docs/guides/USER-GUIDE.md) (plain language),
[API reference](docs/guides/API.md), [database tables](docs/guides/DATABASE.md).

## Common commands (run in `frontend/`)

| Command                                                             | Does                                       |
| ------------------------------------------------------------------- | ------------------------------------------ |
| `pnpm review`                                                       | Run Orbit, Relay and Storybook in parallel |
| `pnpm --filter nova-orbit dev`                                      | Run one app                                |
| `pnpm storybook`                                                    | Run Storybook only                         |
| `pnpm test`                                                         | All unit and page tests (Vitest)           |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` / `pnpm format:check` | Code checks                                |
| `pnpm review:check`                                                 | All of the checks above in one go          |

## Repository layout

```
frontend/
  apps/nova-orbit     strategies, backtests, compare, market data
  apps/nova-relay     broker accounts, rate limits, data jobs, audit
  packages/ui-core    generic components + NOVA Style theme tokens
  packages/ui-trading trading components (P&L, charges, charts)
  packages/contracts  API types + Zod schemas (the wire format)
  packages/mocks      static JSON per contract + MSW handlers
  packages/services   the only data layer: fetch + validate + TanStack Query hooks
  packages/ui-storybook
docs/                 plan, architecture, decisions, maps, task board
```

The full map is in [`docs/STRUCTURE.md`](docs/STRUCTURE.md).

## How data flows

Screens → `@nova/services` hooks → `fetch /api/v1/…` → MSW (mock mode) serving `@nova/mocks`.
Every response is validated against its `@nova/contracts` schema. In real mode (`dev:real`) the same calls go
through the dev server's `/api` proxy to the NOVA Core gateway. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
and [`docs/CONTRACTS.md`](docs/CONTRACTS.md).

## Conventions

- Money in integer paise, shown as INR with Indian grouping (`₹5,00,000`) and explicit signs.
- Times stored in UTC, shown in IST (`Asia/Kolkata`).
- Colours, fonts and spacing only from theme tokens; dark theme by default, light supported.
- Mobile-first: every screen works from 360px.
- Brand names come only from [`brand.config.ts`](brand.config.ts).

## Working on NOVA

Development is run by AI agents following a shared rulebook:

- [`AGENTS.md`](AGENTS.md): rules for every agent (read first).
- [`docs/tasks/BOARD.md`](docs/tasks/BOARD.md): task board. One task per branch (`task/NOVA-###`).
- [`CLAUDE.md`](CLAUDE.md) / [`GEMINI.md`](GEMINI.md): per-agent roles.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): why things are the way they are.
- [`START-HERE.md`](START-HERE.md): first-time setup.
