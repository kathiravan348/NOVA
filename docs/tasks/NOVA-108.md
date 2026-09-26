# NOVA-108 — Orbit: view any strategy version and compare two side by side (D60)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-108 · **Depends on:** NOVA-104

## Goal
On a strategy's **Versions** tab the Owner opens any version's full rules, and compares two versions side by
side with the changed lines highlighted and each version's backtest record, to build better strategies.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D60; `docs/CONTRACTS.md` (Strategy, StrategyStats `byVersion`)
- `frontend/apps/nova-orbit/src/pages/strategies/{StrategyDetailPage,StrategySpecCard,strategies.test}.tsx`
- `frontend/apps/nova-orbit/src/lib/strategyText.ts` (+ test); `frontend/apps/nova-orbit/src/routes.tsx`

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/strategies/{StrategyVersionPage,CompareVersionsPage}.tsx`
- `frontend/apps/nova-orbit/src/lib/specLines.ts`, `specLines.test.ts`
Modify:
- `frontend/apps/nova-orbit/src/pages/strategies/{StrategyDetailPage,strategies.test}.tsx`, `frontend/apps/nova-orbit/src/routes.tsx`
- `docs/guides/USER-GUIDE.md`

## Build
1. `specLines(spec)` (pure): ordered `{key, label, value}` rows built from `strategyText` helpers: Mode,
   Segment, Timeframe, each entry/exit condition ("Entry 1", …, with the all/any heading), Sizing, Stop loss,
   Target, Cost averaging; Python mode adds the code as one row per line (`Code 12`). `diffLines(a, b)` pairs
   rows by `key` and marks each `same | changed | only-a | only-b`.
2. `/strategies/:id/versions/:version` (`StrategyVersionPage`): version, note, saved date, `StrategySpecCard`
   for that version, and its record from `byVersion` ("3 completed backtests · best return +5.2%", linking the
   best run); **Run backtest** with this version preselected; a link back.
3. Versions tab: each row links to its page; tick boxes allow two versions; **Compare versions** →
   `/strategies/:id/compare?a=1&b=3`.
4. `CompareVersionsPage`: two columns (older left), rows from `diffLines`; changed rows use the warning tone,
   rows present on one side only show "—" on the other; a "Show changes only" switch; the top rows give each
   version's completed backtests and best return. At 360px each row stacks: label, then v1 and v3 values.
5. USER-GUIDE Step (strategies): opening an old version, comparing two versions.

## Acceptance checks
- [ ] Vitest: `specLines` for a visual and a Python spec; `diffLines` marks a changed stop loss, an added exit
      rule and a changed code line; the version page shows v1's rules; compare shows the changed rows and
      "Show changes only" hides the same ones; the Compare button needs exactly two ticks.
- [ ] Checked at 360px and desktop, dark and light.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Editing or deleting strategy versions. Backend (106). Backtest screens (107).

## Questions

## Handoff

## Review
