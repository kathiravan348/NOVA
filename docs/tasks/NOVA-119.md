# NOVA-119 — Orbit editor: rotation mode (D62 (4))

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-119 · **Depends on:** NOVA-118 · **Merge after:** NOVA-117

## Goal
The editor gets a third mode, **Rotation**, so momentum-rotation strategies can be created, edited and versioned like the
others. It replaces NOVA-114's "cannot be edited here yet" message.

## Read first
- `AGENTS.md` §6; `docs/DECISIONS.md` D62; `docs/STRATEGY-LIBRARY.md` §3; every file under Files

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/editor/{RotationFields,ScoreTermsEditor}.tsx`
- `frontend/apps/nova-orbit/src/pages/editor/editorFormRotation.ts` (+ `.test.ts`)
Modify:
- `frontend/apps/nova-orbit/src/pages/editor/{ModeSwitch,StrategyEditorPage,BasicsFields,SpecPreview}.tsx`, `editorForm.ts`
- `frontend/apps/nova-orbit/src/pages/editor/{editor.test.tsx,editorForm.test.ts}`; `docs/guides/USER-GUIDE.md`

## Build
1. `ModeSwitch`: **Visual rules** / **Python** / **Rotation**. Choosing Rotation locks segment to equity delivery and
   timeframe to 1 day (the fields show but are disabled, with the hint "Rotation runs on daily prices, delivery only").
   It hides sizing, averaging, entry/exit rules, code and **Portfolio**. **Exits** and **Market filter** stay. The market
   filter default here is **Sell everything**.
2. `RotationFields.tsx` (card **Rotation**) has:
   - **Rebalance**: **Every week** / **Every month** / **Every quarter**
   - **Hold** (1–50)
   - **Keep while in top** (≥ Hold, ≤ 100), with the hint "A holding is sold only when it falls below this rank"
   - **Only stocks where…**: an optional rule group, using the existing `RuleGroupEditor` in a filter variant
3. `ScoreTermsEditor.tsx` (**Score**) has 1–3 rows. Each row has an operand (price or indicator) and a **Weight**
   (non-zero), plus **Add term** / remove. The hint reads "Stocks with the highest score are held".
4. `editorFormRotation.ts`: the rotation form fields, their checks, and `rotationFromSpec` / `rotationToSpec`, which builds
   `StrategySpecRotation`. Switching modes keeps the name and description; other fields reset to that mode's defaults,
   after a confirm if anything would be lost.
5. USER-GUIDE Orbit Step 4: a "Rotation strategies" part covering what rebalance, hold, keep-while-in-top and score mean,
   with the 12-1 momentum example. Update "State as of".

## Acceptance checks
- [ ] The "12-1 momentum rotation" mock opens, shows its settings and saves unchanged (identical spec).
- [ ] You cannot save: keep < hold, 0 or 4 terms, weight 0, or a filter row that is not complete.
- [ ] Creating a new rotation strategy posts a valid `StrategyCreate` (schema-checked in the test).
- [ ] Checked at 360px and desktop, dark and light; `pnpm review:check` passes.

## Out of scope
- Engine work (NOVA-117); library (NOVA-121/122); unequal weights.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
