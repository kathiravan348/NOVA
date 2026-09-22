# NOVA-015 — Orbit: strategy editor — visual rule builder (static)

**Status:** planned · **Owner:** - · **Branch:** task/NOVA-015 · **Depends on:** NOVA-008, NOVA-014

## Goal
`/strategies/new` and `/strategies/:id/edit` open a form (React Hook Form + Zod) that builds a visual Strategy Spec: basics, universe, sizing, risk, and entry/exit rule groups with add/remove conditions. Save validates against `StrategySpecVisualSchema` and shows a demo toast; nothing is stored (Stage A).

## Read first
- `AGENTS.md` (§6, §7), `docs/DECISIONS.md` (D20)
- `frontend/packages/contracts/src/strategy.ts`, `frontend/packages/ui-core/src/components/Field/FormExample.stories.tsx`
- `frontend/packages/ui-core/src/components/{Input,Select,Button,IconButton,Card}/*.tsx`, `Toast/useToast.ts`
- `frontend/apps/nova-orbit/src/{routes.tsx,lib/*.ts,pages/strategies/*.tsx,components/QueryState.tsx,test/renderApp.tsx}`

## Files
Create in `frontend/apps/nova-orbit/src/pages/editor/`:
- `editorForm.ts` (form schema, `emptyForm`, `fromSpec`, `toSpec`), `editorForm.test.ts`
- `StrategyEditorPage.tsx`, `BasicsFields.tsx`, `RuleGroupEditor.tsx`, `OperandFields.tsx`, `SpecPreview.tsx`, `editor.test.tsx`
Modify: orbit `package.json`, `src/routes.tsx`, `src/pages/strategies/{StrategiesPage.tsx,StrategyDetailPage.tsx}`, `frontend/pnpm-lock.yaml`

## Build
1. Orbit deps: `react-hook-form` 7.88.0, `@hookform/resolvers` 5.9.1, `zod` 4.6.5 (ui-core's versions).
2. `editorForm.ts`: `EditorFormSchema` (Zod) for the form shape: `name` (required), `description`, `segment`, `exchange`, `timeframe`, `universeType` (`symbols`|`index`), `symbols` (comma text; ≥1 symbol when `symbols`), `index`, `sizingType` + `qty` / `amountRupees` / `percent` (the chosen one required, positive; percent ≤ 100), `stopLossPercent` / `targetPercent` (optional positive), `entry`/`exit` = `{ combinator, conditions: { left, op, right }[] (min 1) }`, operand form = `{ kind, field, name, period, value }`. `fromSpec(StrategySpecVisual)` and `toSpec(form)` (rupees → paise, symbols trimmed/upper-cased, indicator `period` → `params: { period }`, omitted for `vwap`). `toSpec` output must pass `StrategySpecVisualSchema`. Tests: round-trip every mock visual spec (`fromSpec` → `toSpec` equals the spec); each sizing type; invalid forms fail with field messages.
3. `OperandFields`: kind `Select` (Price, Indicator, Number) then: price → field `Select`; indicator → name `Select` + period `Input` (hidden for VWAP); number → value `Input`. Labels are visually hidden but present (`sr-only` label text via the control's `label`).
4. `RuleGroupEditor` (`useFieldArray`): combinator `Select` ("All conditions" / "Any condition"), one row per condition: left `OperandFields`, op `Select` (crosses above/below, >, ≥, <, ≤, =), right `OperandFields`, remove `IconButton` (disabled when only one). "Add condition" `Button` (ghost). Rows stack vertically below `md`, one line from `md`.
5. `BasicsFields`: `Card` sections "Basics" (name, description, segment, exchange, timeframe), "Universe", "Sizing" (fields shown for the chosen type), "Risk".
6. `SpecPreview`: `Card` "Spec preview (JSON)" with `<pre>` of `toSpec(watch())` when valid, else "Fix the errors above to see the spec". Mono, `text-body-sm`, scrolls inside itself.
7. `StrategyEditorPage`: new → `emptyForm`; edit → `useStrategy(id)` via `QueryState`, latest version; python spec → `EmptyState` "Python strategies use the code editor" (NOVA-016 replaces this). Title "New strategy" / "Edit strategy". Buttons: "Save draft" (submit) and "Cancel" (link back). On valid submit: `toast` "Draft saved (demo only, not stored)". On invalid: errors under fields, focus first error.
8. Entry points: `StrategiesPage` gets a header row with "New strategy" (`Button asChild` + `Link`); detail header gets "Edit".
9. Tests (`renderApp`): new form shows 1 entry and 1 exit row; add/remove condition; empty name → error, no toast; valid form → toast; edit `stg_001` prefills name and 2 entry conditions; python strategy shows the code-editor note.

## Acceptance checks
- [ ] Usable at 360px (fields stack, no page scroll) and desktop; dark/light; keyboard-only works (labels, focus order).
- [ ] Spec preview for an unchanged `stg_001` equals its latest spec.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Persisting, versioning, mutations or MSW POST handlers; Python mode (016); drag-and-drop; nested groups.

## Questions

## Handoff

## Review
