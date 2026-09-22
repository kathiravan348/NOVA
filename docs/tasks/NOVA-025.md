# NOVA-025 — Theme: `on-action` text token, used by Button primary

**Status:** ready-for-review · **Owner:** Gemini · **Branch:** task/NOVA-025 · **Depends on:** NOVA-007

## Goal
Text on the `action` fill comes from a theme token (`text-on-action`) instead of the arbitrary `text-[white]` in Button primary (NOVA-007 review), with a test that it keeps 4.5:1 contrast in both themes.

## Read first
- `AGENTS.md` (§6), `docs/DECISIONS.md` (D15)
- `frontend/packages/ui-core/src/theme/{tokens.json,tokens.test.ts}` (tokens.json: only the `color.tokens` array)
- `frontend/packages/ui-core/package.json` (`tokens` script)
- `frontend/packages/ui-core/src/components/Button/{Button.tsx,Button.test.tsx}`

## Files
Modify:
- `frontend/packages/ui-core/src/theme/tokens.json`
- `frontend/packages/ui-core/src/theme/tokens.css`, `tailwind-theme.css` (generated only, via `pnpm --filter @nova/ui-core tokens`)
- `frontend/packages/ui-core/src/theme/tokens.test.ts`
- `frontend/packages/ui-core/src/components/Button/{Button.tsx,Button.test.tsx}`

## Build
1. In `tokens.json`, add after `action-subtle`: `{ "name": "on-action", "value": { "dark": "#FFFFFF", "light": "#FFFFFF" }, "usage": "Text and icons on an action fill (primary button)." }`. Change the `action` usage text from "(white text on it)" to "(on-action text on it)".
2. Run `pnpm --filter @nova/ui-core tokens`. Do not hand-edit the generated CSS. `pnpm lint` (which runs `build-tokens --check`) must pass.
3. `Button.tsx`: primary variant `text-[white]` → `text-on-action`. Nothing else changes.
4. `tokens.test.ts`: add a WCAG contrast helper (relative luminance from hex) and a test: `on-action` on `action` ≥ 4.5 in dark and in light.
5. `Button.test.tsx`: primary button has class `text-on-action` and no `text-[white]`.

## Acceptance checks
- [x] `grep -rn "text-\[" frontend/packages/ui-core/src/components` finds nothing.
- [x] Storybook `Foundations/Tokens` lists `on-action`; `Core/Button` primary looks unchanged in dark and light, 0 a11y violations.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Any other token value or name, the generator script, other components, other arbitrary values.

## Questions
None.

## Handoff
- Added `on-action` token (`#FFFFFF` dark/light) to `tokens.json` and updated `action` usage description.
- Re-generated `tokens.css` and `tailwind-theme.css` via `pnpm --filter @nova/ui-core tokens`.
- Replaced `text-[white]` in `Button.tsx` primary variant with `text-on-action`.
- Added WCAG contrast ratio calculations and assertions in `tokens.test.ts` ensuring ≥ 4.5:1 contrast against `action` in both dark and light modes.
- Added test in `Button.test.tsx` verifying primary variant has `text-on-action` and no arbitrary white.
- Verified 0 instances of `text-[` in `frontend/packages/ui-core/src/components`.
- Full suite green: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check`.

## Review

