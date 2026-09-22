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
| NOVA-021 | Review build: one-command local run, demo walkthrough doc, feedback checklist | draft | — | 018, 020, 029 |
| NOVA-022 | Scope freeze (Claude + Owner): apply feedback to docs, plan Stage B | draft | — | 021 |
| NOVA-023 | Contracts (Relay): broker account, rate limit, data job, audit entry | done | Claude | 004 |
| NOVA-024 | MSW: handlers for every contract endpoint serving `@nova/mocks` + ApiError contract + handler tests | done | Claude | 005 |
| NOVA-025 | Theme: add `on-action` text token (dark/light) and use it in Button primary, Checkbox, Switch instead of `[white]` | done | Claude | 007, 008 |
| NOVA-026 | ui-core: Modal, Tabs, Toast (split from 010) | done | Claude | 010 |
| NOVA-027 | Lint: fail on Tailwind classes with no theme token (ui-core, ui-trading) | done | Claude | 010 |
| NOVA-028 | ui-trading: CandlestickChart (Lightweight Charts), theme-aware, responsive | done | Claude | 011 |
| NOVA-029 | Market data: Instrument + Candle contracts, mocks, handlers, services, Orbit market data browser (split from 018) | done | Claude | 028, 013 |

## Parallel lanes (tasks that can run at the same time)
- After 001: lane A = 002 → 003 → 007…, lane B = 004 → 023 → 005 → 024 → 006.
- After 007: 008, 009, 010, 011, 025 touch different folders and can overlap (shared files: AGENTS §3 rule 3). 026 follows 010.
- After 013: Orbit screens (014–018) and Relay screens (019–020) can overlap.
