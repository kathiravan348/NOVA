# NOVA-119 — Orbit editor: rotation mode (D62 (4))

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-119 · **Depends on:** NOVA-118 · **Merge after:** NOVA-117

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
Done. `editorFormRotation.ts`: rebalance, hold, keep while in top, 1–3 score terms (price/indicator + non-zero
weight), optional filter group; checks, `rotationFromSpec` / `rotationToSpec`. `editorForm.ts`: mode `rotation`,
`modeDefaults(mode)` (rotation = delivery, 1 day, market filter default **Sell everything**), `hasModeWork`, `fromSpec`
takes any spec and `toSpec` builds `StrategySpecRotation`; only the chosen mode's fields are checked (hidden sizing and
portfolio never block). Rule-group form helpers moved to `operandForm.ts` (shared with the filter).
`ModeSwitch`: three modes; a switch keeps name and description and resets the rest to that mode's defaults, asking
first in a Modal (**Keep editing** / **Switch**) when settings would be lost. `RotationFields` + `ScoreTermsEditor`
(Add term up to 3, remove down to 1); the filter reuses `RuleGroupEditor` (`group="filter"`). `BasicsFields` in
rotation: Segment/Timeframe shown disabled with the hint, card **Risk** keeps stop-loss and target, no sizing or
averaging; `Portfolio` is hidden. The "cannot be edited here yet" screen is gone.
- Tests: `editorFormRotation.test.ts` (valid defaults, keep < hold, 0 and 4 terms, weight 0, unfinished filter row,
  filter only when on); `editor.test.tsx` (stg_005 saves the identical spec, new rotation posts a body that passes
  `StrategyCreateSchema`, mode-switch confirm); every mock (visual, python, rotation) round-trips in `editorForm.test.ts`.
- Preview (mock): stg_005 edit shows Basics, Risk, Exits, Market filter, Rotation, Score, filter; no overflow at 360 px.
- Deviation: visual ↔ Python switches now also reset to that mode's defaults (the task's rule for all switches).
Commands: `pnpm review:check` passed. Guides: USER-GUIDE (Step 4c).

## Review
Built and reviewed by Claude. Acceptance checks pass. Merged.
