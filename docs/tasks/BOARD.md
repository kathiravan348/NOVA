# NOVA — Task board

> Read at the start of every session. Update status + owner BEFORE starting work.
> Statuses: planned · in-progress · ready-for-review · in-review · changes-requested · done
> A task is written when it has a file in `docs/tasks/`. Claude writes each next task file from `docs/templates/TASK.md` before it becomes `planned`; until then its status is `draft`.

| ID | Title | Status | Owner | Depends on |
|---|---|---|---|---|
| NOVA-001 | Monorepo setup: pnpm workspaces, Vite, TS strict, ESLint, Prettier, Vitest, .gitattributes | done | Claude | — |
| NOVA-002 | Theme pipeline: tokens.json → tokens.css (dark/light), Tailwind v4 theme, fonts, `data-theme` switch | done | Claude | 001 |
| NOVA-003 | Storybook (`ui-storybook`): theme toggle, 360px/768px/1440px viewports, a11y addon | done | Claude | 002 |
| NOVA-004 | Contracts (Orbit): user, strategy spec, backtest run/result, trade, charges | done | Claude | 001 |
| NOVA-005 | Mocks: static JSON per contract (consistent numbers) + schema and consistency tests | done | Claude | 004, 023 |
| NOVA-006 | Services layer: `DATA_MODE` mock/real switch + TanStack Query hooks | done | Claude | 024 |
| NOVA-007 | ui-core: Button, IconButton, Badge/StatusBadge, Card, StatCard, Skeleton | done | Claude | 003 |
| NOVA-008 | ui-core: form fields (Field, Input, Select, Checkbox, Switch, DateTimePicker IST), RHF + Zod example | done | Claude | 007 |
| NOVA-009 | ui-core: DataTable (TanStack Table; sort, paginate; stacked cards on mobile) | done | Claude | 007 |
| NOVA-010 | ui-core: AppShell (sidebar, mobile menu, top bar), NavItem, ThemeToggle, DemoBanner, EmptyState | done | Claude | 007 |
| NOVA-011 | ui-trading: PriceText, PnLText, PnLCard, ChargesBreakdown, Meter, INR formatters | done | Claude | 007 |
| NOVA-012 | ui-trading: EquityCurve (Recharts), responsive | done | Claude | 011 |
| NOVA-013 | Shared login screen (mock super-admin auth) + app routing skeletons for Orbit and Relay | done | Claude | 006, 010 |
| NOVA-014 | Orbit: strategy list + strategy detail (versions, status) | done | Claude | 009, 013, 026 |
| NOVA-015 | Orbit: strategy editor — visual rule builder (static) | done | Claude | 008, 014 |
| NOVA-016 | Orbit: strategy editor — Python mode (CodeMirror view, static) | done | Claude | 015 |
| NOVA-017 | Orbit: run-backtest form + backtest results screen | done | Claude | 012, 014 |
| NOVA-018 | Orbit: compare runs (market data split to 029) | done | Claude | 017 |
| NOVA-019 | Relay: overview + broker accounts (session status, daily login prompt) | done | Claude | 009, 013, 026 |
| NOVA-020 | Relay: rate limits, data jobs, audit log | done | Claude | 019 |
| NOVA-021 | Review build: one-command local run, demo walkthrough doc, feedback checklist | done | Claude | 018, 020, 029 |
| NOVA-022 | Scope freeze (Claude + Owner): apply feedback to docs, plan Stage B | done | Claude | 041 |
| NOVA-023 | Contracts (Relay): broker account, rate limit, data job, audit entry | done | Claude | 004 |
| NOVA-024 | MSW: handlers for every contract endpoint serving `@nova/mocks` + ApiError contract + handler tests | done | Claude | 005 |
| NOVA-025 | Theme: add `on-action` text token (dark/light) and use it in Button primary, Checkbox, Switch instead of `[white]` | done | Claude | 007, 008 |
| NOVA-026 | ui-core: Modal, Tabs, Toast (split from 010) | done | Claude | 010 |
| NOVA-027 | Lint: fail on Tailwind classes with no theme token (ui-core, ui-trading) | done | Claude | 010 |
| NOVA-028 | ui-trading: CandlestickChart (Lightweight Charts), theme-aware, responsive | done | Claude | 011 |
| NOVA-029 | Market data: Instrument + Candle contracts, mocks, handlers, services, Orbit market data browser (split from 018) | done | Claude | 028, 013 |
| NOVA-030 | Instrument info: sector, indices, last close, change, 52w range, volume, lot size; 24 mock instruments (R2) | done | Claude | 029 |
| NOVA-031 | Universe moves from strategy to backtest run: contracts, mocks, editor, detail, run list, compare (R2, D25) | done | Claude | 030 |
| NOVA-032 | StrategyStats contract + `/strategies/stats` mock, handler, service (R1, D26) | done | Claude | 031 |
| NOVA-033 | ui-core DataTable: row selection (checkbox column, select all shown) + search box (D29) | done | Claude | 009 |
| NOVA-034 | ui-trading StrategyCard + Orbit strategies card grid (filter, sort) + detail stats and Backtests tab (R1) | done | Claude | 032 |
| NOVA-035 | Orbit backtest form: symbol picker (DataTable selection, filters, data-coverage check) (R2) | done | Claude | 031, 033 |
| NOVA-036 | Orbit market data page: instrument list with search and info instead of a select (R2) | done | Claude | 030, 033 |
| NOVA-037 | Backtest result: per-symbol breakdown + trade symbol filter (R2) | done | Claude | 031 |
| NOVA-038 | Relay contracts: RateLimit v2 (windows, broker/NOVA limits, reset), BrokerProfile, session expiry fix (R3, R4) | done | Claude | 023 |
| NOVA-039 | Relay rate limits page v2: per-window usage, reset time, edit NOVA limit modal, 80% warnings (R3) | done | Claude | 038 |
| NOVA-040 | Relay broker page (profile + useful links) and account detail limits/session countdown (R4) | done | Claude | 038 |
| NOVA-041 | Review guide round 2: walkthrough + checklist for round 1 changes | done | Claude | 034–040 |
| NOVA-042 | Faster checks: no duplicate tsc, tool caches, threads pool (D30) | done | Claude | — |
| NOVA-060 | Dev machine rules: fnm + pnpm, uv, Docker Desktop limits (D36) | done | Claude | — |
| NOVA-043 | Backend skeleton: Compose (TimescaleDB, Redis), uv workspace, NOVA Core health, backend-check (D33) | done | Claude | 022 |
| NOVA-044 | Contract parity: JSON Schema from Zod, Pydantic models + parity tests (User, ApiError) (D34) | done | Claude | 043 |
| NOVA-045 | Pagination envelope: contracts, mock handlers, services (screens unchanged) (D32) | done | Claude | 022 |
| NOVA-046 | Load more on backtests, trades, data jobs, audit; strategy detail uses `strategyId` filter | draft | — | 045 |
| NOVA-047 | Database schema v1 + Alembic migrations (all Phase 1 tables, candles hypertable) | draft | — | 043 |
| NOVA-048 | NOVA Core: super-admin auth (session cookie), `/me`, gateway routing, audit writes | draft | — | 044, 047 |
| NOVA-049 | Broker: Kite login flow, encrypted token store, session expiry, accounts + profiles endpoints (D35) | draft | — | 048 |
| NOVA-050 | Broker: rate limiter (Redis, endpoint × window), rate-limits GET/PATCH + audit; verify daily reset | draft | — | 049 |
| NOVA-051 | Atlas: instrument master + historical candle downloads, data-jobs and market-data endpoints; job queue | draft | — | 050 |
| NOVA-052 | Atlas: live tick recorder + Parquet archive (D11) | draft | — | 051 |
| NOVA-053 | Ledger: charges engine (equity delivery + intraday), dated rate tables | draft | — | 047 |
| NOVA-054 | Strategy service: strategies CRUD, versions, stats summary | draft | — | 048 |
| NOVA-055 | Backtest engine v1: equity delivery, visual specs, results, trades, per-symbol breakdown | draft | — | 051, 053, 054 |
| NOVA-056 | Backtest engine: equity intraday | draft | — | 055 |
| NOVA-057 | Backtest engine: Python-mode strategies in a restricted sandbox | draft | — | 055 |
| NOVA-058 | Real mode: login + Relay screens on the real API | draft | — | 046, 050, 051 |
| NOVA-059 | Real mode: Orbit screens on the real API | draft | — | 055, 058 |

## Parallel lanes (tasks that can run at the same time)
- After 001: lane A = 002 → 003 → 007…, lane B = 004 → 023 → 005 → 024 → 006.
- After 007: 008, 009, 010, 011, 025 touch different folders and can overlap (shared files: AGENTS §3 rule 3). 026 follows 010.
- After 013: Orbit screens (014–018) and Relay screens (019–020) can overlap.
- Review round 1 (see `docs/PLAN.md`): 030, 033, 038 run in parallel. Then Orbit 031 → 032 → 034 and 035/036/037; Relay 039 and 040 in parallel.
- Stage B (after 022): lane A = 043 → 044 / 047 (backend); lane B = 045 → 046 (frontend) runs alongside. Then 048 → 049 → 050 → 051; 053 and 054 can overlap 049–051.
