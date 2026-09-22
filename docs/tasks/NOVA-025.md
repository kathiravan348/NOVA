# NOVA-025 — Theme: `on-action` token, used by Button primary, Checkbox, Switch

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-025 · **Depends on:** NOVA-007, NOVA-008

## Goal
Text, icons and thumbs on the `action` fill come from a theme token (`on-action`) instead of the arbitrary `text-[white]` / `bg-[white]` in Button primary, Checkbox and Switch (NOVA-007/008 reviews), with a test that it keeps 4.5:1 contrast in both themes.

## Read first
- `AGENTS.md` (§6), `docs/DECISIONS.md` (D15)
- `frontend/packages/ui-core/src/theme/{tokens.json,tokens.test.ts}` (tokens.json: only the `color.tokens` array)
- `frontend/packages/ui-core/package.json` (`tokens` script)
- `frontend/packages/ui-core/src/components/{Button,Checkbox,Switch}/` (component + test)

## Files
Modify:
- `frontend/packages/ui-core/src/theme/tokens.json`
- `frontend/packages/ui-core/src/theme/tokens.css`, `tailwind-theme.css` (generated only, via `pnpm --filter @nova/ui-core tokens`)
- `frontend/packages/ui-core/src/theme/tokens.test.ts`
- `frontend/packages/ui-core/src/components/Button/{Button.tsx,Button.test.tsx}`
- `frontend/packages/ui-core/src/components/Checkbox/{Checkbox.tsx,Checkbox.test.tsx}`
- `frontend/packages/ui-core/src/components/Switch/{Switch.tsx,Switch.test.tsx}`

## Build
1. In `tokens.json`, add after `action-subtle`: `{ "name": "on-action", "value": { "dark": "#FFFFFF", "light": "#FFFFFF" }, "usage": "Text, icons and thumbs on an action fill (primary button, checked checkbox, switch)." }`. Change the `action` usage text from "(white text on it)" to "(on-action text on it)".
2. Run `pnpm --filter @nova/ui-core tokens`. Do not hand-edit the generated CSS. `pnpm lint` (which runs `build-tokens --check`) must pass.
3. `Button.tsx` primary variant and `Checkbox.tsx` checked state: `text-[white]` → `text-on-action`. `Switch.tsx` thumb: `bg-[white]` → `bg-on-action`. Nothing else changes.
4. `tokens.test.ts`: add a WCAG contrast helper (relative luminance from hex) and a test: `on-action` on `action` ≥ 4.5 in dark and in light.
5. Tests: Button primary and Checkbox root classes contain `text-on-action`; Switch thumb has `bg-on-action`; none contain `[white]`.

## Acceptance checks
- [ ] `grep -rn "\[white\]" frontend/packages/ui-core/src/components` finds nothing.
- [ ] Storybook `Foundations/Tokens` lists `on-action`; `Core/Button` primary, `Core/Checkbox` and `Core/Switch` look unchanged in dark and light, 0 a11y violations.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Any other token value or name, the generator script, other components, other arbitrary values.

## Questions

## Handoff
- Added `on-action` token (`#FFFFFF` dark/light) to `tokens.json` and updated `action` usage description.
- Re-generated `tokens.css` and `tailwind-theme.css` via `pnpm --filter @nova/ui-core tokens`.
- Replaced `text-[white]` in `Button.tsx` primary variant with `text-on-action`.
- Added WCAG contrast ratio calculations and assertions in `tokens.test.ts` ensuring ≥ 4.5:1 contrast against `action` in both dark and light modes.
- Added test in `Button.test.tsx` verifying primary variant has `text-on-action` and no arbitrary white.
- Verified 0 instances of `text-[` in `frontend/packages/ui-core/src/components`.
- Full suite green: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check`.

## Review
**Result:** done
**Fixed directly (review: commits):**
- Branch started from an old main, so it had the pre-NOVA-008 task file (Button only). Restored the extended scope and did it here: Checkbox check `text-on-action`, Switch thumb `bg-on-action`, `on-action` usage text updated, tokens regenerated, tests added.
- Merged main; task file = main's scope + Gemini's handoff.
**Change requests (if sent back):** none.
**Rulebook issues found:** start each task branch from current `main` (this one was based on `ff6a15b`).
**Follow-up tasks created:** none.
