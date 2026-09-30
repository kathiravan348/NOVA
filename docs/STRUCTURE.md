# NOVA — Repository map

> Update this file in the same task that adds or moves a folder.

```
/
├─ AGENTS.md            rulebook (all agents)
├─ CLAUDE.md            Claude's role
├─ GEMINI.md            Gemini's role
├─ brand.config.ts      all brand names
├─ docs/
│  ├─ PLAN.md  ARCHITECTURE.md  STRUCTURE.md  CONTRACTS.md  COMPONENTS.md  DECISIONS.md
│  ├─ STRATEGY-LIBRARY.md the 100 library strategies, exact rules (D62, D73; NOVA-121, 144)
│  ├─ STRATEGY-TESTING.md fair chronological comparisons and known research limits (D73)
│  ├─ REVIEW-GUIDE.md   Stage A: how to run (`pnpm review`), walkthrough, feedback checklist
│  ├─ guides/           USER-GUIDE.md (plain-language UI walkthrough), API.md (every endpoint), DATABASE.md (every table)
│  ├─ tasks/            BOARD.md + one file per task (NOVA-###.md)
│  └─ templates/        TASK.md, HANDOFF.md, REVIEW.md
├─ frontend/            (created by NOVA-001)
│  ├─ packages/
│  │  ├─ ui-core/       generic components + theme tokens
│  │  │  ├─ scripts/    build-tokens generator
│  │  │  ├─ src/components/ Button, IconButton, Badge, StatusBadge, Card, StatCard, Skeleton, Field, Input, Select, Checkbox, Switch, DateTimePicker, Pager (range, total, page/size controls)
│  │  │  ├─ src/lib/    cn utility, zonedTime UTC/IST conversion
│  │  │  └─ src/theme/  tokens.json, tokens.css, tailwind-theme.css, styles.css
│  │  ├─ ui-trading/    trading components built on ui-core
│  │  ├─ ui-storybook/  Storybook for both libraries
│  │  │  ├─ .storybook/ Storybook config (main, preview)
│  │  │  └─ src/foundations/ Tokens stories
│  │  ├─ contracts/     API types + Zod schemas
│  │  │                 `src/live.ts`: ticks, subscriptions, snapshots and recorded-day summaries (D74)
│  │  │  └─ schema/     generated JSON Schema per wire contract (D34; do not edit)
│  │  ├─ services/      data layer (mock | real)
│  │  │                 `src/realtime.ts` + `liveSubscriptions.ts`: shared socket, combined live selections and tick handlers; `api/live.ts`, `queries/live.ts`: reads and polling fallback
│  │  │  ├─ src/api/    one fetch function per endpoint (validated by contract schema)
│  │  │  ├─ src/queries/ TanStack Query keys, hooks, createQueryClient; approvals.ts = approval + agent hooks (D67)
│  │  │  └─ src/session.ts mock sign-in session (D23)
│  │  └─ mocks/         static JSON per contract + MSW handlers
│  │     ├─ data/       static mock JSON per contract
│  │     │             `liveTicks.json`, `liveSnapshot.json`, `liveDays.json`: eight stocks, TCS has recorder gaps (D74)
│  │     ├─ src/handlers/ MSW handlers for contracts and scenarios; approvals.ts = approval + agent mocks (D67)
│  │     └─ src/browser.ts MSW browser worker (apps' main.tsx, mock mode)
│  └─ apps/             each: public/mockServiceWorker.js, src/routes.tsx, layout/, pages/
│     ├─ nova-orbit/    strategy builder + backtesting (port 3000)
│     └─ nova-relay/    API config + limits (port 3001); pages/approvals/ = approval decisions, history and agent account (D67)
│                       Approvals uses compact selectable rows, bulk decisions and full-detail dialogs (NOVA-141); shared ui-core TextBlock renders request/response text.
├─ compose.yaml         db, redis, migrate, broker, strategy, backtest(+worker), atlas(+worker), core, backend-check
├─ .env.example         every variable with dummy values (copy to .env)
└─ backend/             uv workspace (D33, D36); Dockerfile = one image for all services
   ├─ scripts/check.sh  ruff, format, mypy per package, pytest
   ├─ libs/
   │  ├─ nova_common/   Settings (NOVA_* env), ApiException + error handlers, openapi_url (D50)
   │  ├─ nova_db/       models, migrations (`python -m nova_db upgrade|check`), queue + paging helpers (D37, D41)
   │  ├─ nova_ledger/   charges per trade from dated `charge_rates` rows (D42)
   │  ├─ nova_contracts/ Pydantic models mirroring @nova/contracts + parity tests (D34)
   │  └─ nova_testing/  shared test helpers: `parity.Parity`, `db` + `redis` fixtures, `kite.FakeKite`, `broker.FakeBroker`
   └─ services/
      ├─ core/          NOVA Core: sign-in, /me, /audit, gateway to services; agent_rules.py denies unlisted agent requests and holds writes (D67); approval_routes.py lists/replays/rejects held requests, agent_routes.py manages the single agent account; sessions.py revokes user sessions, cli.py shares create_user; tests/test_approvals.py and test_agent_account.py cover decisions and account access; API docs when NOVA_API_DOCS (D50), with an Agent tag (D67); `python -m nova_core create-admin`
      ├─ broker/        the only Kite caller (D35): accounts, profile, daily login, rate limiter (Redis, D40),
      │                 `/internal/kite/*` data for other services (D41); live tick recorder (D49);
      │                 `live_publish.py`: committed ticks → Redis `nova:ticks`; Core `live_realtime.py` fans out selected stocks once a second (D74)
      │                 `python -m nova_broker add-account | new-token-key | record-ticks | recorder` (always-on, D54)
      ├─ strategy/      strategies, immutable versions, stats summary in SQL (D26, D43)
      ├─ backtest/      queue runs (D44), runs/results/trades API, worker; strategy engine (visual + Python
      │                 sandbox, delivery + intraday, D45–D47)
      └─ atlas/         NOVA Atlas: stock list (`universe` table) + instrument sync, data jobs + worker (Postgres queue, D41);
                        `unavailable.py`: successful broker-check evidence, automatic recovery and paged unavailable-date history (D70, migration 0022); Relay `stored-data/UnavailableDataPanel.tsx` uses shared `UnavailableDataTable`.
                        Parquet tick archive (D49); `python -m nova_atlas sync-instruments | download | worker | archive-ticks`
                        `live.py` + `live_storage.py`: latest-price snapshot and per-day tick/second/gap summaries from PostgreSQL and projected Parquet batches (D74)
```
