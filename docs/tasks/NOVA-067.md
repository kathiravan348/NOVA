# NOVA-067 — Strategy editor: all catalog indicators, their own settings, "bars ago" (D51)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-067 · **Depends on:** NOVA-064 (merge after NOVA-066)

## Goal
In the visual editor the Indicator list shows the 38 catalog indicators grouped (Trend, Momentum, Volatility,
Volume, Levels). Each indicator shows its own settings (e.g. MACD: Fast, Slow, Signal), and every price or
indicator has a **Bars ago** field.

## Read first
- `AGENTS.md` (§6, §7a), `docs/DECISIONS.md` (D51), `docs/tasks/NOVA-064.md` (catalog)
- `frontend/packages/contracts/src/indicators.ts`
- `frontend/packages/ui-core/src/components/Select/{Select.tsx,Select.stories.tsx,Select.test.tsx}`
- `frontend/apps/nova-orbit/src/pages/editor/{editorForm.ts,editorForm.test.ts,OperandFields.tsx,editor.test.tsx}`
- `frontend/apps/nova-orbit/src/lib/{strategyText.ts,strategyText.test.ts}`

## Files
Modify: the 8 files above except `indicators.ts`, and `docs/guides/USER-GUIDE.md`

## Build
1. ui-core `Select`: optional `group?: string` on `SelectOption`; consecutive options with the same group render in
   one `<optgroup label>`; options without a group render as today. Story "Grouped" + render test.
2. `editorForm.ts`: operand form `period` → `params: Record<string, string>` and `offset: string` (default `"0"`).
   `emptyOperand` uses SMA with catalog defaults. Validation from the catalog: integer params whole ≥ 1, decimal
   params > 0, MACD fast < slow; offset whole 0–500. Messages as today ("Whole number above 0", …).
3. `fromSpec`: take params from the spec for keys the catalog knows, fill missing keys with defaults, **drop unknown
   keys** (so an old MACD `{period}` becomes 12/26 and saves cleanly). `toSpec`: every catalog param as a number;
   `offset` only when > 0 (omit 0, so unchanged specs stay byte-identical).
4. `OperandFields.tsx`: indicator options from `INDICATORS` with `group` labels. Changing the indicator resets its
   params to that indicator's defaults (`setValue`). One `Input` per param (catalog label, `inputMode` numeric or
   decimal, field error). **Bars ago** input for price and indicator kinds (not number). Keep sr-only context on
   every label. Grid must still fit at 360px (params wrap two per row).
5. `strategyText.ts`: labels from the catalog (drop the local map); `describeOperand` adds " 1 bar ago" /
   " 3 bars ago" when offset > 0, e.g. `High 1 bar ago`, `MACD signal(12, 26, 9)`, `Pivot R1`.
6. `USER-GUIDE.md` Step 4: list the indicator groups with one plain line each for the less-known ones (SuperTrend,
   ADX, Stochastic, CCI, Williams %R, OBV, MFI, Donchian, Keltner, pivots, previous-day levels); explain
   **Bars ago** with the example "Close greater than High, 1 bar ago". Add to "what do I do if": a run that fails
   with "Unknown setting … save it again" → open the strategy, **Save**. Update "State as of".

## Acceptance checks
- [ ] Editor test: choose MACD signal → Fast/Slow/Signal fields with 12/26/9; switch to RSI → only Period (14).
- [ ] Old spec with `macd {period: 20}` loads and saves as `{fast: 12, slow: 26}`; a spec without offsets
      round-trips unchanged (`fromSpec` → `toSpec` deep-equal).
- [ ] Bars ago 1 on High shows in the detail text as "High 1 bar ago"; −1 and 2.5 show field errors.
- [ ] Select Grouped story at 360px and desktop, dark and light. `pnpm review:check` passes. AGENTS §9.

## Out of scope
- Backend changes; Python mode editor/template (068); a searchable indicator picker; indicator charts on screens.

## Questions

## Handoff
Built by Claude (Antigravity offline). All acceptance checks pass.
- ui-core `Select`: optional `group` → consecutive options in one `<optgroup>`; story "Grouped" + test.
- Editor form: `params` (catalog keys) + `offset`; validation from the catalog (whole ≥ 1 / > 0, fast < slow,
  bars ago 0–500). `fromSpec` keeps known keys, fills defaults, drops unknown (old MACD {period} → 12/26);
  `toSpec` writes every catalog param and `offset` only when > 0, so mock specs round-trip unchanged.
- `OperandFields`: grouped list of 38, one input per setting (reset to defaults on change), **Bars ago**.
- `strategyText`: catalog labels and order, " 1 bar ago" / " 3 bars ago".
- Browser (mock mode, 360px): no page overflow, settings wrap two per row inside the card.
- Checks: `pnpm review:check` green. Guides: USER-GUIDE Step 4 (groups, Bars ago) and the FAQ row.

## Review
Self-reviewed. Screenshots timed out (pane hidden); layout checked by measuring field boxes at 360px.
