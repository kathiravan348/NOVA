# NOVA-028 — ui-trading: CandlestickChart (Lightweight Charts), theme-aware, responsive

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-028 · **Depends on:** NOVA-011

## Goal
`@nova/ui-trading` exports `CandlestickChart`: OHLC candles (optional volume) drawn with TradingView Lightweight Charts, coloured from theme tokens, that re-colours on theme switch and resizes with its container.

## Read first
- `AGENTS.md` (§5–8), `docs/DECISIONS.md` (D15, D17), `docs/COMPONENTS.md`
- `frontend/packages/contracts/src/common.ts` (`Timeframe` only)
- `frontend/packages/ui-trading/{package.json,src/index.ts,src/format/money.ts}`
- `frontend/packages/ui-core/src/theme/{tokens.css,theme.ts}` (variable names; `data-theme` on `<html>`)
- `frontend/packages/ui-trading/src/components/Meter/*` (pattern: component, story, test)

## Files
Create in `frontend/packages/ui-trading/src/`:
- `components/CandlestickChart/{CandlestickChart.tsx,CandlestickChart.stories.tsx,CandlestickChart.test.tsx,storyData.ts,types.ts}`
- `lib/useThemeColors.ts` + `lib/useThemeColors.test.ts`
Modify: `frontend/packages/ui-trading/{package.json,src/index.ts}`, `frontend/pnpm-lock.yaml`, `docs/COMPONENTS.md`

## Build
1. Deps in ui-trading `dependencies`: `lightweight-charts` 5.x (exact latest stable), `date-fns` 4.4.0 and `date-fns-tz` 3.2.0 (same versions as ui-core). v5 API: `createChart`, `chart.addSeries(CandlestickSeries | HistogramSeries, opts)`.
2. `types.ts`: `interface Candle { time: string; openPaise: number; highPaise: number; lowPaise: number; closePaise: number; volume?: number }` — `time` is `YYYY-MM-DD` for `1d`, UTC ISO (`…Z`) for intraday (D17). This is a props type only; the market-data contract comes with NOVA-018.
3. `useThemeColors(names: string[])`: reads `getComputedStyle(document.documentElement).getPropertyValue("--" + name).trim()` for each name, returns a record; re-reads when `data-theme` changes (`MutationObserver` on `<html>` attributes). Test: switching `data-theme` updates the values (set CSS vars inline in the test).
4. `CandlestickChart` props: `candles: Candle[]`, `timeframe: Timeframe`, `showVolume?` (default true when any candle has volume), `height?` (default 320; 240 below `md`), `loading?`, `emptyText?` (default "No candles"), `ariaLabel: string`, `className`.
   - Create the chart once in `useEffect` on a `ref` div with `autoSize: true`; `chart.remove()` on unmount. Map paise → rupees (`/ 100`) for series values; intraday `time` → UTC seconds; `1d` → the `YYYY-MM-DD` string.
   - Colours from `useThemeColors(["profit","loss","text-muted","border-default","bg-surface","font-mono"])`: up/wick-up `profit`, down/wick-down `loss`, grid `border-default`, text `text-muted`, background `bg-surface`, font `font-mono`. `chart.applyOptions` / `series.applyOptions` when colours change. Volume histogram at the bottom 20% (`priceScaleId: ""`, `scaleMargins { top: 0.8, bottom: 0 }`), colour by candle direction.
   - `localization.priceFormatter` = `formatPrice` on paise (rupees × 100); `timeVisible` for intraday. Time shown in IST: `localization.timeFormatter` via date-fns-tz `formatInTimeZone(…, "Asia/Kolkata", …)`.
   - Wrapper `role="img"` + `aria-label`, visually hidden summary: "{n} candles, {first} to {last}, last close {formatPrice}".
5. States: `loading` → ui-core `Skeleton` at chart height; no candles → centred `emptyText`; the chart is not created in either state.
6. `storyData.ts`: 60 daily and 75 five-minute candles, fixed numbers from a plain loop (no `Math.random`), high ≥ max(open, close), low ≤ min(open, close). Stories `Trading/CandlestickChart`: Daily, Intraday5m, NoVolume, Loading, Empty, Narrow (360px).
7. Tests: `vi.mock("lightweight-charts")` with a fake `createChart` recording calls; assert series data mapping (paise → rupees, time conversion), colours applied from CSS vars and re-applied after a `data-theme` switch, `remove()` on unmount, loading/empty do not call `createChart`, summary text. Candle data sanity test on `storyData`.

## Acceptance checks
- [ ] Story renders in dark and light; switching theme re-colours without reload; no hex in components.
- [ ] At 360px the chart fits with no horizontal page scroll; resizing the window resizes the chart.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Indicators, drawing tools, trade markers, crosshair legends, live updates, data fetching, a Candle contract or mock endpoint (NOVA-018).

## Questions

## Handoff
**Done:** `CandlestickChart` (Lightweight Charts 5), `Candle` type, `useThemeColors` hook, 6 stories, tests.
**Files changed:** as listed, plus `ui-core/scripts/check-classes.{ts,test.ts}` (see deviations).
**Commands run:** lint / typecheck / test / build / format:check → all pass (yes)
**Checked:** 360px ✓ · desktop ✓ · dark ✓ · light ✓ (theme switch re-colours live; intraday axis in IST 09:15–15:25)
**New dependencies:** `lightweight-charts@5.2.1` (in stack), `date-fns-tz@3.2.0` (same as ui-core).
**Maps updated:** COMPONENTS.
**Deviations from task:** `timeScale.tickMarkFormatter` also formats axis ticks in IST (Lightweight Charts shows UTC otherwise). Candle scale keeps a 25% bottom margin so candles clear the volume band; volume hides its last-value label. `check-classes` treated the CSS-variable names (`"text-muted"`) as classes; a literal that is exactly one colour name is now skipped (+ test).
**Known gaps:** none.

## Review
**Result:** done (built by Claude while Gemini is offline; checked in Storybook)
**Fixed directly (review: commits):** none.
**Rulebook issues found:** none.
**Follow-up tasks created:** none.
