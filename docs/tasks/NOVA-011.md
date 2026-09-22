# NOVA-011 — ui-trading: INR formatters, PriceText, PnLText, PnLCard, ChargesBreakdown, Meter

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-011 · **Depends on:** NOVA-007

## Goal
`@nova/ui-trading` has tests and exports the money/number formatters (paise → Indian-grouped text, explicit signs) and the first five trading components built on ui-core.

## Read first
- `AGENTS.md` (§6–8, esp. §7 formats), `docs/COMPONENTS.md`
- `frontend/packages/ui-trading/{package.json,tsconfig.json,src/index.ts}`
- `frontend/packages/ui-core/{vitest.config.ts,vitest.setup.ts}` (copy), `frontend/packages/ui-core/src/index.ts`
- `frontend/packages/ui-core/src/components/{Card/Card.tsx,StatCard/StatCard.tsx}`
- `frontend/packages/contracts/src/charges.ts`

## Files
Create in `frontend/packages/ui-trading/`:
- `vitest.config.ts`, `vitest.setup.ts` (copies of ui-core's)
- `src/format/money.ts` + `money.test.ts`
- `src/components/<Name>/<Name>.tsx`, `.stories.tsx`, `.test.tsx` for PriceText, PnLText, PnLCard, ChargesBreakdown, Meter
- `src/components/ChargesBreakdown/storyData.ts` (charges fixtures shared by story and test)
Modify: `frontend/packages/ui-trading/{package.json,tsconfig.json,src/index.ts}`, `frontend/pnpm-lock.yaml` (via `pnpm install`), `docs/COMPONENTS.md`

## Build
1. `package.json`: script `"test": "vitest run"`; dependency `@nova/contracts` (`workspace:*`); devDeps `vitest` 3.2.7, `@storybook/react-vite` 10.6.0. `tsconfig.json`: include `vitest.setup.ts`. Keep `UI_TRADING_NAME`.
2. `src/format/money.ts` (pure functions, `Intl.NumberFormat("en-IN")`, minus sign is `−` U+2212, never `-0`):
   - `formatInr(paise, { decimals = 2, signed = false })`: `50000000` → `₹5,00,000.00`; `{ decimals: 0 }` → `₹5,00,000`; `{ signed: true }`: `9824400` → `+₹98,244.00`, `-1423600` → `−₹14,236.00`, `0` → `₹0.00`. Negative is always `−₹…` even when not signed.
   - `formatPrice(paise)`: `161890` → `1,618.90` (no ₹, 2 decimals).
   - `formatPercent(value, { decimals = 2, signed = false })`: `12.345` → `12.35%`; signed `-0.11` → `−0.11%`, `1.5` → `+1.50%`, `0` → `0.00%`.
   - `formatQuantity(n)`: `150000` → `1,50,000`.
   - Rounding for `decimals: 0` = half away from zero on the rupee value. Tests cover every example above, crore values (`₹1,23,45,678.90`) and 1-paise values.
3. **PriceText**: `paise`, `currency?` (prefix ₹), `className`. `<span class="font-mono tabular-nums">`.
4. **PnLText**: `paise`, `percent?` (appended ` (+1.23%)`), `decimals?`. Always signed. Colour `text-profit` > 0, `text-loss` < 0, `text-text-primary` at 0. Mono.
5. **PnLCard**: ui-core `StatCard` with `label`, `paise`, `percent?`, `caption?`, `loading?`; value is PnLText.
6. **ChargesBreakdown**: ui-core `Card` titled `title` (default "Charges"). Props `charges: Charges` (type import from `@nova/contracts`), `hideZero?`, `loading?`. A `<dl>` of rows: Brokerage, STT/CTT, Exchange txn, SEBI fee, Stamp duty, GST, DP charges, then Total (top border, semibold, `text-loss`). Amounts via `formatInr`, right-aligned mono. `hideZero` drops zero rows except Total. No arithmetic: Total shows `totalPaise`.
7. **Meter**: `label`, `value`, `max`, `valueText?` (e.g. `"7 / 10 per sec"`; default `"value / max"`), `warnAt = 0.8`, `dangerAt = 0.95` (fractions). `role="meter"` with `aria-valuemin/max/now` and `aria-valuetext`. Track `bg-bg-raised h-2 rounded-xs`, fill width = value/max (clamped 0–100%) via inline style, colour `bg-action` / `bg-warning` / `bg-loss` by threshold. Label and valueText above the bar.
8. Stories under `Trading/<Name>`: PriceText (Default, WithCurrency), PnLText (Profit, Loss, Zero, WithPercent), PnLCard (Profit, Loss, Loading), ChargesBreakdown (Delivery with DP, Intraday HideZero, Loading), Meter (Normal, Warning, Danger, Full). Values are typed by hand; the fixtures in `storyData.ts` must pass `ChargesSchema.parse` (the test checks this).
9. Component tests: rendered text uses the formatters, PnLText colour class by sign, PnLCard loading skeleton, ChargesBreakdown row count with/without `hideZero`, Meter aria values and threshold colour.

## Acceptance checks
- [ ] `pnpm test` runs the ui-trading tests (root vitest picks up the new `vitest.config.ts`).
- [ ] Stories render in dark and light, 0 a11y violations, no horizontal scroll at 360px.
- [ ] No hex in components; ui-trading imports ui-core only from `@nova/ui-core`.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Charts (NOVA-012). Date/time formatters. Computing charges or net P&L. Changes to ui-core or contracts.

## Questions

## Handoff

## Review
