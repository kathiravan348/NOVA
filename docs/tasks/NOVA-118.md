# NOVA-118 — Orbit editor: multiplier, exits, portfolio, market filter (D62)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-118 · **Depends on:** NOVA-112, NOVA-114 · **Merge after:** NOVA-115

## Goal
The visual and Python editors can set and save every D62 (3) field: operand multiplier, trailing stop, ATR stop, max hold,
max positions with a rank, and the market filter. Loading and saving a strategy keeps all of them. Merge only after
NOVA-115. Until NOVA-117 lands, a backtest of a strategy with a market filter fails with a clear message (NOVA-115 step 5).

## Read first
- `AGENTS.md` §6; `docs/DECISIONS.md` D51, D53, D62; `docs/STRATEGY-LIBRARY.md` §1; every file under Files

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/editor/{ExitsFields,PortfolioFields,RegimeFields}.tsx`
- `frontend/apps/nova-orbit/src/pages/editor/editorFormExtras.ts` (+ `.test.ts`)
Modify:
- `frontend/apps/nova-orbit/src/pages/editor/{editorForm.ts,OperandFields.tsx,StrategyEditorPage.tsx,SpecPreview.tsx}`
- `frontend/apps/nova-orbit/src/pages/editor/{editor.test.tsx,editorForm.test.ts}`
- `frontend/apps/nova-orbit/src/pages/strategies/StrategyDetailPage.tsx` (Versions column uses `modeLabel`, NOVA-114)
- `docs/guides/USER-GUIDE.md`

## Build
1. `editorFormExtras.ts`: the form fields (strings, like the existing ones) for the new settings, their checks, and
   `extrasFromSpec(spec)` / `extrasToSpec(form)`. `editorForm.ts` imports it and drops below 300 lines: move code there if needed.
   An empty field means absent; absent is never written (D62).
2. `OperandFields.tsx`: price and indicator operands get an optional **×** number box (placeholder "1"). Empty or 1 → no
   multiplier. Rule text shows "1.5 × Volume SMA(50)".
3. `ExitsFields.tsx` (card **Exits**, below **Sizing and risk**) has three fields:
   - **Trailing stop %** (> 0, ≤ 50)
   - **ATR stop**: switch + **Period** + **× ATR**
   - **Exit after N bars** (1–5000)

   Each has a one-line hint, e.g. "Sells if the price falls this % below its highest close since buying".
4. `PortfolioFields.tsx` (card **Portfolio**) has:
   - **Max positions** (1–100, empty = no limit)
   - **Rank buys by**: an operand picker limited to price or indicator, via `OperandFields`
   - **Order**: **Highest first** / **Lowest first**
5. `RegimeFields.tsx` (card **Market filter**) has:
   - a switch
   - **Index**, from `useMarketIndices`
   - one condition: left operand, operator, right operand, evaluated on the index's prices
   - **When the filter fails**: **No new buys** / **Sell everything**

   Default when switched on: NIFTY 50 `close > SMA(200)`, **No new buys**.
6. Both modes show the three cards (Python too). `SpecPreview` shows the new JSON.
7. USER-GUIDE Orbit Step 4: one short paragraph per card in plain words, and what "rank" and "market filter" mean.
   Update "State as of".

## Acceptance checks
- [ ] Round trip: opening the "Turtle 55/20 (ranked)" mock and saving unchanged posts an identical spec. Clearing a field removes it.
- [ ] Validation messages for each out-of-range field; the Save button is disabled until they are fixed.
- [ ] Stories are not needed (app components). Page tests cover each card at 360px (stacked) and desktop, dark and light.
- [ ] `pnpm review:check` passes.

## Out of scope
- Rotation mode editing (NOVA-119); engine work; new indicators (they appear through the catalog).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
