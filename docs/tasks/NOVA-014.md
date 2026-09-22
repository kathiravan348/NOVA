# NOVA-014 — Orbit: strategy list + strategy detail (versions, status)

**Status:** planned · **Owner:** - · **Branch:** task/NOVA-014 · **Depends on:** NOVA-009, NOVA-013, NOVA-026

## Goal
`/strategies` lists every strategy from `useStrategies()`; `/strategies/:id` shows one strategy: header, latest spec summary (universe, sizing, risk, entry/exit rules in words) and its version history.

## Read first
- `AGENTS.md` (§6, §7), `docs/COMPONENTS.md`
- `frontend/packages/contracts/src/strategy.ts`, `frontend/packages/mocks/data/strategies.json`
- `frontend/packages/ui-core/src/components/{DataTable/DataTable.tsx,DataTable/columnMeta.ts,Tabs/Tabs.tsx,StatusBadge/StatusBadge.tsx,EmptyState/EmptyState.tsx,Card/Card.tsx}`
- `frontend/apps/nova-orbit/src/{routes.tsx,routes.test.tsx,layout/AppLayout.tsx}`

## Files
Create:
- ui-core `src/components/DescriptionList/{DescriptionList.tsx,DescriptionList.stories.tsx,DescriptionList.test.tsx}`
- orbit `src/lib/{format.ts,strategyText.ts,strategyText.test.ts}`, `src/test/renderApp.tsx`
- orbit `src/pages/strategies/{StrategiesPage.tsx,StrategyDetailPage.tsx,StrategySpecCard.tsx,QueryState.tsx,strategies.test.tsx}`
Modify: orbit `package.json`, `src/routes.tsx`; ui-core `src/index.ts`; `frontend/pnpm-lock.yaml`; `docs/COMPONENTS.md`

## Build
1. Orbit deps: `@tanstack/react-table` 8.21.3, `date-fns` 4.4.0, `date-fns-tz` 3.2.0 (ui-core's versions).
2. `DescriptionList` (ui-core): `items: { label: ReactNode; value: ReactNode; numeric?: boolean }[]`, `columns?: 1 | 2` (2 from `md`). `<dl>`, label `text-body-sm text-text-muted`, value `text-body text-text-primary`, numeric values mono + right-aligned. Stories: Default, TwoColumns, 360px. Test: renders dt/dd pairs.
3. `lib/format.ts`: `formatIstDate(utc)` → `21 Sep 2026`, `formatIstDateTime(utc)` → `21 Sep 2026, 12:00 IST` (date-fns-tz, `Asia/Kolkata`); label maps for `Segment`, `Timeframe`, `StrategyStatus` (+ `statusTone`: active→success, draft→info, archived→neutral).
4. `lib/strategyText.ts`: `describeOperand`, `describeCondition` ("Close crosses above VWAP", "RSI(14) < 30"), `describeRuleGroup` ("All of: …" / "Any of: …"), `describeUniverse`, `describeSizing` (INR via `formatInr` from ui-trading), `describeRisk` ("Stop-loss 1.5% · Target 3%", "None"). Tests cover each operand kind, op and sizing type.
5. `QueryState.tsx`: renders children when data is ready; else loading skeleton rows, `EmptyState tone="error"` with a "Try again" `Button` (`refetch`), or 404 → `EmptyState` "Not found" + link back.
6. `StrategiesPage`: `DataTable` (caption "Strategies"): Name (link to detail, `primary`), Status (`StatusBadge`), Mode ("Visual"/"Python"), Segment, Timeframe, Version (`v2`, numeric), Updated (`formatIstDate`, numeric). Initial sort Updated desc. Empty → `EmptyState` "No strategies yet".
7. `StrategyDetailPage` (`useParams().id` → `useStrategy`): `Card` header (name, `StatusBadge`, description, "Updated …"), `Tabs` "Specification" | "Versions". Specification = `StrategySpecCard` for the latest version: `DescriptionList` (Mode, Segment, Exchange, Timeframe, Universe, Sizing, Risk) + entry/exit rule text (python mode: "Python strategy: rules live in code (NOVA-016)"). Versions = `DataTable` (Version, Created IST, Mode, Note), sorted newest first. Route handle title "Strategy"; page shows the name as `h2`.
8. `test/renderApp.tsx`: `renderApp(path, { signedIn })` → sets `sessionStorage["nova-session"]`, renders `routes` in a memory router + `QueryClientProvider`; tests start their own MSW server.
9. Tests: list shows all 3 mock strategies with badges; clicking a name opens detail; detail shows rule text and 2 versions for `stg_001`; `stg_002` shows the python note; unknown id → "Not found"; `emptyHandlers` → empty state; `errorHandlers` → error state with "Try again".

## Acceptance checks
- [ ] Both pages at 360px (table → cards, no page scroll) and desktop, dark/light; `DemoBanner` visible.
- [ ] Numbers mono and right-aligned; dates in IST.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Editing (015/016), running backtests (017), archiving/status changes, search/filter.

## Questions

## Handoff

## Review
