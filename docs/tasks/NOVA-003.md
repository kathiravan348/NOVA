# NOVA-003 — Storybook

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-003 · **Depends on:** NOVA-002

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
- [ ] `pnpm storybook` opens on :6006. Foundations/Tokens renders with background `#10172A` in dark and `#F5F6F8` in light, switched from the toolbar.
- [ ] The viewport menu offers mobile/tablet/desktop. At 360px, Colors wraps with no horizontal scroll.
- [ ] The a11y panel shows 0 violations on every Tokens story in both themes.
- [ ] `pnpm build` produces `packages/ui-storybook/storybook-static/` (git-ignored). Definition of done in `AGENTS.md` §9.

## Out of scope
- Any ui-core/ui-trading component or story, Storybook deps in ui-core/ui-trading (NOVA-007), Storybook test runner/Vitest addon, Chromatic, MDX docs pages, changes to `tokens.json` or `styles.css`.

## Questions

## Handoff

## Review
