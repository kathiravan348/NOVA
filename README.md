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

All commands run in `frontend/`. There are two ways to run NOVA, each with one command:

| Mode          | First time only   | Every day     | Stop                            | Sign-in                             |
| ------------- | ----------------- | ------------- | ------------------------------- | ----------------------------------- |
| **Mock mode** | `pnpm install`    | `pnpm review` | `Ctrl+C`                        | Any username and password (demo)    |
| **Real mode** | `pnpm real:setup` | `pnpm real`   | `Ctrl+C`, then `pnpm real:stop` | Your super-admin email and password |

Mock mode needs no backend and uses sample data: good for looking at screens and UI work.
Real mode runs the backend in Docker (start Docker Desktop first) and uses real data, backtests and the Kite login.

### Option A: UI only (mock mode)

```bash
cd frontend
pnpm install      # first time only
pnpm review
```

This starts Orbit (http://localhost:3000), Relay (http://localhost:3001) and Storybook (http://localhost:6006).
For a guided tour see [`docs/REVIEW-GUIDE.md`](docs/REVIEW-GUIDE.md).

### Option B: backend + UI (real mode)

**First time only:**

```bash
cd frontend
pnpm real:setup
```

This does everything in order:

1. creates `.env` from `.env.example` with random secrets (an existing `.env` is kept)
2. installs the frontend packages
3. builds the backend image
4. fills `NOVA_BROKER_TOKEN_KEY`
5. starts the backend and waits for NOVA Core
6. asks for your email, name and password to create the super-admin

The super-admin is the account you sign in with. If you skip it, run `pnpm real:admin` later.

**Every day:**

```bash
cd frontend
pnpm real
```

This starts the backend (`docker compose up -d`) and waits until NOVA Core answers. Then it starts Orbit
(http://localhost:3000) and Relay (http://localhost:3001) against it. The apps send `/api` to NOVA Core on port 8000
(D48). If port 3000 or 3001 is already taken, for example by `pnpm review`, it stops and tells you.

**Stop:** `Ctrl+C` stops the apps. `pnpm real:stop` stops the backend (`docker compose down`). Your data stays in the
Docker volumes (`db-data`, `tick-archive`). Only `docker compose down -v` deletes it.

| Command           | Does                                               |
| ----------------- | -------------------------------------------------- |
| `pnpm real:setup` | First-time setup (safe to run again: keeps `.env`) |
| `pnpm real`       | Start backend + Orbit + Relay in real mode         |
| `pnpm real:admin` | Create the super-admin (backend must be running)   |
| `pnpm real:stop`  | Stop the backend                                   |

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
| `nova-tick-recorder`   | Always on: records live ticks on market days while recording is switched on (`PUT /broker/recorder`) |

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
| `pnpm real` / `pnpm real:setup`                                     | Real mode: backend + Orbit + Relay         |
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
