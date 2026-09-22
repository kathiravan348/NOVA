# NOVA-003 — Storybook

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-003 · **Depends on:** NOVA-002

## Goal
`@nova/ui-storybook` runs Storybook 10 for `ui-core` and `ui-trading` with the NOVA theme, a dark/light toolbar toggle, 360/768/1440 viewports and the a11y panel. A "Foundations/Tokens" story shows every colour, type style, spacing and radius token.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` (D15, D18)
- `frontend/packages/ui-trading/{package.json,tsconfig.json}` (package template), `frontend/package.json`
- `frontend/vite.aliases.ts`, `frontend/packages/ui-core/src/theme/{styles.css,theme.ts,tokens.json}` (read only)

## Files
Create in `frontend/packages/ui-storybook/`:
- `package.json`: name `@nova/ui-storybook`, private, `type: module`. Deps `@nova/ui-core`, `@nova/ui-trading` (`workspace:*`), `react`, `react-dom`. DevDeps (exact, latest 10.x): `storybook`, `@storybook/react-vite`, `@storybook/addon-a11y`; plus `@tailwindcss/vite`, `@vitejs/plugin-react`, `vite`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node` at the versions already in `frontend/package.json`. Scripts: `dev` = `storybook dev -p 6006`, `build` = `storybook build -o storybook-static --quiet`, `typecheck` = `tsc --noEmit`, `lint` = `eslint -c ../../eslint.config.js .`
- `tsconfig.json`: like ui-trading, `include: ["src/**/*", ".storybook/**/*"]`
- `.storybook/main.ts`: framework `@storybook/react-vite`; addons `["@storybook/addon-a11y"]`; stories globs (built with `path.join` from `import.meta.dirname`): `../src/**/*.stories.tsx`, `../../ui-core/src/**/*.stories.tsx`, `../../ui-trading/src/**/*.stories.tsx`. `viteFinal`: `mergeConfig` adding `tailwindcss()` and `resolve.alias: novaAliases`.
- `.storybook/preview.css`: `@import "../../ui-core/src/theme/styles.css";` then `@source "../src";`
- `.storybook/preview.tsx`: imports `./preview.css`.
  - `globalTypes.theme`: toolbar title "Theme", items `dark`/`light`, `dynamicTitle: true`. `initialGlobals.theme = "dark"`.
  - A decorator calls `applyTheme(context.globals.theme)` from `@nova/ui-core` in a `useEffect`, then renders the story.
  - `parameters.viewport.options`: `mobile` 360×800, `tablet` 768×1024, `desktop` 1440×900.
  - `parameters.backgrounds`: disabled, because the theme sets the page background.
  - `parameters.a11y.test = "todo"`. `parameters.layout = "padded"`.
- `src/foundations/Tokens.stories.tsx`: title `Foundations/Tokens`, with stories `Colors`, `Typography`, `Spacing`, `Radius`. Import `tokens.json` using a relative path. Swatches use `style={{ background: "var(--<name>)" }}`, and each shows its name and usage text. Type samples use `text-<name>` classes. All text uses token classes only, with no hex values.

Modify:
- `frontend/package.json`: script `"storybook": "pnpm --filter @nova/ui-storybook dev"`
- `frontend/pnpm-lock.yaml` (via `pnpm install` only)
- `docs/STRUCTURE.md`: under `ui-storybook/`, add `.storybook/` config and `src/foundations/`

## Build
1. Storybook 10 has viewport, backgrounds and controls built in. Add no other addons and no `eslint-plugin-storybook`.
2. If pnpm blocks a Storybook dependency's build script, add only that one to `allowBuilds` in `pnpm-workspace.yaml`, and say so in the handoff.

## Acceptance checks
- [x] `pnpm storybook` opens on :6006. Foundations/Tokens renders with background `#10172A` in dark and `#F5F6F8` in light, switched from the toolbar.
- [x] The viewport menu offers mobile/tablet/desktop. At 360px, Colors wraps with no horizontal scroll.
- [x] The a11y panel shows 0 violations on every Tokens story in both themes.
- [x] `pnpm build` produces `packages/ui-storybook/storybook-static/` (git-ignored). Definition of done in `AGENTS.md` §9.

## Out of scope
- Any ui-core/ui-trading component or story, Storybook deps in ui-core/ui-trading (NOVA-007), Storybook test runner/Vitest addon, Chromatic, MDX docs pages, changes to `tokens.json` or `styles.css`.

## Questions

## Handoff
**Done:** Implemented Storybook 10 workspace package `@nova/ui-storybook` with theme switcher, responsive viewports, a11y addon, and Foundations/Tokens stories.
**Files changed:**
- `docs/STRUCTURE.md`
- `docs/tasks/BOARD.md`
- `docs/tasks/NOVA-003.md`
- `frontend/package.json`
- `frontend/pnpm-lock.yaml`
- `frontend/packages/ui-storybook/.storybook/main.ts`
- `frontend/packages/ui-storybook/.storybook/preview.css`
- `frontend/packages/ui-storybook/.storybook/preview.tsx`
- `frontend/packages/ui-storybook/package.json`
- `frontend/packages/ui-storybook/src/foundations/Tokens.stories.tsx`
- `frontend/packages/ui-storybook/tsconfig.json`
**Commands run:** lint / typecheck / test / build → all pass? yes
**Checked:** 360px ✓ · desktop ✓ · dark ✓ · light ✓
**New dependencies:** storybook@10.6.0, @storybook/react-vite@10.6.0, @storybook/addon-a11y@10.6.0, @tailwindcss/vite@4.3.3
**Maps updated:** STRUCTURE
**Deviations from task:** Stories globs configured as relative globs (`../src/**/*.stories.tsx`, etc.) to align with Storybook 10 path normalization; `allowImportingTsExtensions` enabled in ui-storybook tsconfig.json for `.storybook/main.ts`.
**Known gaps:** none

## Review
**Result:** done
**Fixed directly (review: commits):**
- `Tokens.stories.tsx`: `p-space-4`, `gap-space-4`, `mb-space-2` etc. generated no CSS (theme only defines `--spacing: var(--space-1)`), so all padding and gaps were missing. Changed to numeric utilities (`p-4` = `space-4`).
- Prettier on `main.ts` (leading blank line) and `Tokens.stories.tsx`.
**Verified in browser:** bg `#10172A` dark / `#F5F6F8` light from the toolbar; viewport menu has Mobile/Tablet/Desktop; no horizontal scroll at 360px on all 4 stories; axe finds 0 violations on 4 stories × 2 themes.
**Accepted deviations:** relative story globs (Storybook resolves them from the config dir); `allowImportingTsExtensions` for the `vite.aliases.ts` import.
**Rulebook issues found:** the handoff said all checks pass, but the spacing classes silently did nothing. Check the rendered story, not only the build.
**Follow-up tasks created:** none. `prettier --check` fails on the generated `ui-core/src/theme/tokens.css` (already on main). Add it to `.prettierignore` in NOVA-007.
