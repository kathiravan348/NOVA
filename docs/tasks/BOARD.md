# NOVA — Task board

> Read at the start of every session. Update status + owner BEFORE starting work.
> Statuses: planned · in-progress · ready-for-review · in-review · changes-requested · done
> A task is written when it has a file in `docs/tasks/`. Claude writes each next task file from `docs/templates/TASK.md` before it becomes `planned`; until then its status is `draft`.

| ID | Title | Status | Owner | Depends on |
|---|---|---|---|---|
| NOVA-001 | Monorepo setup: pnpm workspaces, Vite, TS strict, ESLint, Prettier, Vitest, .gitattributes | done | Claude | — |
| NOVA-002 | Theme pipeline: tokens.json → tokens.css (dark/light), Tailwind v4 theme, fonts, `data-theme` switch | done | Claude | 001 |
| NOVA-003 | Storybook (`ui-storybook`): theme toggle, 360px/768px/1440px viewports, a11y addon | planned | — | 002 |
| NOVA-004 | Contracts (Orbit): user, strategy spec, backtest run/result, trade, charges | planned | — | 001 |
| NOVA-005 | Mocks: static JSON per contract (consistent numbers) + MSW handlers + schema tests | draft | — | 004, 023 |
| NOVA-006 | Services layer: `DATA_MODE` mock/real switch + TanStack Query hooks | draft | — | 005 |
| NOVA-007 | ui-core: Button, IconButton, Badge/StatusBadge, Card, StatCard, Skeleton | draft | — | 003 |
| NOVA-008 | ui-core: form fields (Input, Select, Checkbox, Switch, DateTimePicker IST) with RHF + Zod | draft | — | 007 |
| NOVA-009 | ui-core: DataTable (TanStack Table; sort, paginate; stacked cards on mobile) | draft | — | 007 |
| NOVA-010 | ui-core: AppShell (sidebar, mobile menu, top bar), DemoBanner, Modal, Tabs, Toast, EmptyState | draft | — | 007 |
| NOVA-011 | ui-trading: PriceText, PnLText, PnLCard, ChargesBreakdown, Meter, INR formatters | draft | — | 007 |
| NOVA-012 | ui-trading: EquityCurve (Recharts), CandlestickChart (Lightweight Charts), responsive | draft | — | 011 |
| NOVA-013 | Shared login screen (mock super-admin auth) + app routing skeletons for Orbit and Relay | draft | — | 006, 010 |
| NOVA-014 | Orbit: strategy list + strategy detail (versions, status) | draft | — | 009, 013 |
| NOVA-015 | Orbit: strategy editor — visual rule builder (static) | draft | — | 008, 014 |
| NOVA-016 | Orbit: strategy editor — Python mode (CodeMirror view, static) | draft | — | 015 |
| NOVA-017 | Orbit: run-backtest form + backtest results screen | draft | — | 012, 014 |
| NOVA-018 | Orbit: compare runs + market data browser | draft | — | 017 |
| NOVA-019 | Relay: overview + broker accounts (session status, daily login prompt) | draft | — | 009, 013 |
| NOVA-020 | Relay: rate limits, data jobs, audit log | draft | — | 019 |
| NOVA-021 | Review build: one-command local run, demo walkthrough doc, feedback checklist | draft | — | 018, 020 |
| NOVA-022 | Scope freeze (Claude + Owner): apply feedback to docs, plan Stage B | draft | — | 021 |
| NOVA-023 | Contracts (Relay): broker account, rate limit, data job, audit entry | draft | — | 004 |

## Parallel lanes (tasks that can run at the same time)
- After 001: lane A = 002 → 003 → 007…, lane B = 004 → 023 → 005 → 006.
- After 007: 008, 009, 010, 011 touch different folders and can overlap.
- After 013: Orbit screens (014–018) and Relay screens (019–020) can overlap.
