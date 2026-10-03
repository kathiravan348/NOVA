# NOVA-178 — Timeline popup: trade-by-trade vertical timeline (D83)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-178 · **Depends on:** NOVA-177 (merge after it is deployed)

## Goal
The backtest **Timeline** popup shows every buy and sell as a node on a coloured vertical rail, oldest first.
The filters stay fixed at the top. Scrolling loads more trades until the last one.

## Read first
- `AGENTS.md` §6, §7; `docs/DECISIONS.md` row D83; `docs/COMPONENTS.md` (Modal, LoadMore, PnLText, Skeleton)
- `frontend/apps/nova-orbit/src/pages/backtests/TimelineDialog.tsx`; `useBacktestTimeline` (NOVA-177)

## Files
Create:
- `frontend/packages/ui-trading/src/components/TradeTimeline/{TradeTimeline.tsx,TradeTimeline.stories.tsx,TradeTimeline.test.tsx,heldTime.ts,heldTime.test.ts}`
Modify:
- `frontend/packages/ui-trading/src/index.ts`; `frontend/packages/ui-core/src/components/LoadMore/{LoadMore.tsx,LoadMore.test.tsx,LoadMore.stories.tsx}` (`auto`)
- `frontend/apps/nova-orbit/src/pages/backtests/TimelineDialog.tsx`, `timeline.test.tsx`
- `docs/COMPONENTS.md`, `docs/guides/USER-GUIDE.md` (Backtest result → Timeline)
Delete: `frontend/apps/nova-orbit/src/pages/backtests/TimelineDayEvents.tsx`

## Build
1. `LoadMore` gets `auto?: boolean`. When it is true, an IntersectionObserver calls `onLoadMore` when the button
   scrolls into view and nothing is loading. The button stays as the fallback (no observer in jsdom).
2. `heldTime(entryAt, at)`: same IST day → `42 s`, `12 min`, `2 h 5 min` (drop zero parts); different IST
   days → `1 day` / `N days` (calendar days). Unit-test each unit and the boundaries.
3. `TradeTimeline` props: `events: LedgerEvent[]`, `clock: "seconds" | "minutes" | "none"`,
   `reasonLabels: Record<ExitReason, string>`, `loading?`, `emptyState?`. An `<ol aria-label="Trades">`:
   - Desktop (≥ sm): left column with the IST date (body-sm, secondary) and clock (mono); a 4 px rail with a 12 px dot;
     the content on the right. At 360px the left column hides, `date · clock` becomes the first content line.
   - Content: **Buy**/**Sell** + stock, `qty @ price`, Amount; sells add Charges, Net P&L (`PnLText`),
     `Held 12 min` (when `entryAt`), reason (`—` if null); every node: `Cash after ₹…`. Money mono, Indian grouping.
   - Colours (tokens only): buy `action`, sell profit `profit`, sell loss `loss`, sell net 0 `text-muted`. The
     dot and the rail segment above it use them. Text uses `*-text` tokens. A **Stop-loss** reason is a `warning` chip.
   - Clock: `HH:mm:ss` / `HH:mm` / none (date only).
   - Loading: 4 skeleton nodes. Empty: `emptyState`. Stories: mixed (buy, profit, loss, zero, stop-loss), seconds, daily, loading, empty.
4. `TimelineDialog`: filter block (Stock, From, To, same behaviour as now) is `sticky top-0` with the popup's
   background, so only the timeline scrolls under it. Line under it: `N trades` + the averaging note when
   averaging is on. Uses `useBacktestTimeline` (50 per page) and `<LoadMore auto>`. When there are no more pages
   and there are trades, it shows `End of timeline · N trades`. Error → `QueryError` with retry. Clock = `seconds`
   for seconds timeframes or recorded runs, `none` for `1d`, else `minutes`. Remove the Switch, Pager and day table.
5. USER-GUIDE: rewrite the Timeline paragraph (one trade per row, colours, held time, scroll to load more).

## Acceptance checks
- [ ] Mock run: trades show oldest first with the right colours, clock and held time; Stock/From/To filter them.
- [ ] Scrolling to the end loads the next page (test via the LoadMore button); end line shows the count.
- [ ] Filters stay visible while the timeline scrolls (desktop and 360px), dark and light.
- [ ] `pnpm review:check` passes.

## Out of scope
- Backend or contract changes. Day totals/grouping. A calendar, chart or CSV export. Changing `DataTable` row details.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
