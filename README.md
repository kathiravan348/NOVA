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

## Quick start

Prerequisites (Windows, via winget): fnm with Node 24 (`fnm install 24`), pnpm 12 (`winget install pnpm.pnpm`),
and for the backend Docker Desktop (WSL2) and uv (`winget install astral-sh.uv`). Use pnpm and uv only (no npm, no pip).

```bash
cd frontend
pnpm install
pnpm review
```

`pnpm review` starts both apps and Storybook together. Sign in with any username and password (demo sign-in).
For a guided tour and the feedback checklist, see [`docs/REVIEW-GUIDE.md`](docs/REVIEW-GUIDE.md).

What is built today, kept up to date with every task: [user guide](docs/guides/USER-GUIDE.md) (plain language),
[API reference](docs/guides/API.md), [database tables](docs/guides/DATABASE.md).

## Real mode (Stage B)

With the backend running (below) and a super-admin created:

```bash
cd frontend
pnpm --filter nova-relay dev:real
pnpm --filter nova-orbit dev:real
```

Both apps then sign in with your email and password against NOVA Core (`/api` is proxied; D48).

## Backend (Stage B)

```bash
cp .env.example .env
docker compose up -d
docker compose run --rm backend-check
```

NOVA Core answers on http://127.0.0.1:8000/api/v1/health. Details: [`backend/README.md`](backend/README.md).

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
