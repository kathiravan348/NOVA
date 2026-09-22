# NOVA-016 — Orbit: strategy editor — Python mode (CodeMirror, static)

**Status:** planned · **Owner:** - · **Branch:** task/NOVA-016 · **Depends on:** NOVA-015

## Goal
The strategy editor has a mode switch (Visual rules | Python). Python mode edits the strategy code in a token-themed CodeMirror editor; python strategies open in the editor and show their code on the detail page. Save still only validates and toasts.

## Read first
- `AGENTS.md` (§5, §6), `docs/DECISIONS.md` (D19, D20, D24), `docs/ARCHITECTURE.md` (Strategies)
- `frontend/packages/contracts/src/strategy.ts` (`StrategySpecPython`)
- `frontend/packages/ui-core/{package.json,src/index.ts,src/theme/tokens.css}`
- `frontend/apps/nova-orbit/src/pages/editor/*`, `src/pages/strategies/StrategySpecCard.tsx`

## Files
Create:
- ui-core `src/components/CodeEditor/{CodeEditor.tsx,codeTheme.ts,CodeEditor.stories.tsx,CodeEditor.test.tsx}`
- orbit `src/pages/editor/{ModeSwitch.tsx,PythonFields.tsx}`
Modify: ui-core `{package.json,src/index.ts}`; orbit `src/pages/editor/{editorForm.ts,editorForm.test.ts,StrategyEditorPage.tsx,SpecPreview.tsx,editor.test.tsx}`, `src/pages/strategies/StrategySpecCard.tsx`; `frontend/pnpm-lock.yaml`; `docs/{COMPONENTS,DECISIONS}.md`

## Build
1. ui-core deps (exact): `@codemirror/state` 6.7.6, `@codemirror/view` 6.43.13, `@codemirror/language` 6.12.4, `@codemirror/commands` (latest 6.x), `@codemirror/lang-python` 6.2.1, `@lezer/highlight` 1.2.3. No `codemirror` meta package, no `@uiw/*` wrapper. Record D24.
2. `codeTheme.ts`: `EditorView.theme` + `HighlightStyle.define` using only `var(--…)` tokens: background `--bg-surface`, text `--text-primary`, gutter `--bg-raised`/`--text-muted`, caret/selection `--action`/`--action-subtle`, keyword `--action-text`, string `--profit-text`, number `--warning-text`, comment `--text-muted`, font `--font-mono`. Works in both themes because it uses variables.
3. `CodeEditor` (props: `value`, `onChange?`, `readOnly?`, `ariaLabel`, `minHeight?` default 240, `className`): creates one `EditorView` in `useEffect` (extensions: line numbers, history + default keymap, python language, theme, `EditorView.lineWrapping`, `readOnly` via `EditorState.readOnly` + `EditorView.editable`), `destroy()` on unmount; syncs external `value` changes with a transaction when different; content gets `aria-label`. Stories: Editable, ReadOnly, 360px. Tests: shows the code, typing calls `onChange` (dispatch through the view), read-only is not editable.
4. `editorForm.ts`: add `mode: "visual" | "python"` and `code`. Python mode requires non-empty `code`; rule groups are kept but not sent. `fromSpec(name, description, spec: StrategySpec)`; `toSpec` returns `StrategySpec` (python → `StrategySpecPythonSchema.parse`). `PYTHON_TEMPLATE` = a short `on_bar(ctx)` example (ARCHITECTURE: `on_bar(ctx) -> list[Signal]`). Tests: python mock round-trips; empty code fails in python mode only.
5. `ModeSwitch`: radio group (two `<input type="radio">` with labels, styled as a segmented control with tokens) bound to `mode`; switching to python with empty code fills `PYTHON_TEMPLATE`.
6. `PythonFields`: `Card` "Code" with `Controller` → `CodeEditor`, error text below, and a note "Runs in a sandbox in Stage B. Not executed in this prototype."
7. `StrategyEditorPage`: remove the python `EmptyState`; show `RuleGroupEditor`s in visual mode and `PythonFields` in python mode. `SpecPreview` shows either spec.
8. `StrategySpecCard`: python specs show the code in a read-only `CodeEditor` instead of the note.
9. Tests: `/strategies/stg_002/edit` opens in python mode with the mock code; switching a new strategy to Python shows the template and hides the rule editors; saving python with empty code shows "Code is required"; detail of `stg_002` shows the code.

## Acceptance checks
- [ ] Editor readable in dark and light (keywords/strings/comments coloured by tokens, no hex); usable at 360px (wraps, no page scroll); keyboard: Tab leaves the editor (Esc then Tab, per CodeMirror).
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Running, linting or type-checking Python; autocomplete; persistence; diffing versions.

## Questions

## Handoff

## Review
