# NOVA-002 — Theme pipeline

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-002 · **Depends on:** NOVA-001

## Goal
`tokens.json` generates CSS variables (dark + light) and a Tailwind v4 theme, so apps and packages style with token classes only. IBM Plex fonts are self-hosted, and `<html data-theme>` switches the theme.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` (D8, D15, D16)
- `frontend/packages/ui-core/src/theme/tokens.json` (read only, never edit)
- `frontend/vite.aliases.ts`, `frontend/vitest.config.ts`, `frontend/apps/nova-orbit/{vite.config.ts,index.html,src/main.tsx,src/App.tsx}`

## Files
Create (all under `frontend/packages/ui-core/` unless a full path is given):
- `scripts/build-tokens.ts` generator. Run it with `node scripts/build-tokens.ts` (Node 24 strips types). `--check` exits 1 if the output is stale.
- `src/theme/tokens.css` (generated, committed). Colours go in `:root, [data-theme="dark"]` and `[data-theme="light"]` as `--<name>`. Also in `:root`: `--space-*`, `--radius-*`, `--control-height`, `--nav-item-height`, `--sidebar-width`, `--font-sans`, `--font-mono`.
- `src/theme/tailwind-theme.css` (generated). One `@theme inline` block. First reset the defaults with `--color-*: initial; --radius-*: initial; --text-*: initial; --font-*: initial;`, then map every token 1:1: `--color-bg-surface: var(--bg-surface)`, `--radius-md: var(--radius-md)`, `--font-mono: var(--font-mono)`, `--spacing: var(--space-1)`. Each type style becomes `--text-<name>` with `--line-height`, `--font-weight` and `--letter-spacing` sub-values. Result: `bg-bg-surface`, `text-text-muted`, `rounded-lg`, `text-number-lg`, `font-mono`, `p-4` (= space-4).
- `src/theme/styles.css`: `@import "tailwindcss"`, then fontsource CSS (Plex Sans 400/500/600, Plex Mono 400/500), `tokens.css`, `tailwind-theme.css`, `@source "../../../ui-trading/src"`, `@source "../"`. Base styles: `body` uses bg-ground, text-primary, font-sans and the body text style. `:focus-visible` gets a 2px outline in `--action`.
- `src/theme/theme.ts`: `type ThemeName = "dark" | "light"`, `getStoredTheme()` (localStorage key `nova-theme`, default `"dark"`, try/catch), `applyTheme(name)` (sets `document.documentElement.dataset.theme` and stores it).
- `src/theme/theme.test.ts` (jsdom via `// @vitest-environment jsdom`) and `src/theme/tokens.test.ts` (node; every colour token appears in both theme blocks of `tokens.css`)
- `vitest.config.ts` (minimal)

Modify:
- `packages/ui-core/package.json`: deps `tailwindcss`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`; devDeps `@types/node`, `vitest`; scripts `tokens` and `test`. Set `lint` to run `node scripts/build-tokens.ts --check && eslint …`.
- `packages/ui-core/tsconfig.json` (include `scripts`), `packages/ui-core/src/index.ts` (export `theme.ts`; remove `UI_CORE_NAME`)
- `frontend/vite.aliases.ts`: add `"@nova/ui-core/styles.css"` **before** `@nova/ui-core`
- `frontend/vitest.config.ts`: `projects: ["apps/*", "packages/*/vitest.config.ts"]`
- Both apps: `package.json` (devDep `@tailwindcss/vite`), `vite.config.ts` (add plugin), `index.html` (`<html lang="en" data-theme="dark">`), `src/main.tsx` (import styles, `applyTheme(getStoredTheme())`), `src/App.tsx` (heading uses `text-page-title text-text-primary`)
- `docs/STRUCTURE.md` (add `ui-core/scripts`, `theme/`)

## Build
1. Pin exact versions (latest stable Tailwind 4.x and fontsource 5.x). No `tailwind.config.*` and no PostCSS config: Tailwind v4 is configured in CSS.
2. The generator uses `path.join` and writes LF. Output order follows `tokens.json`, and the files start with a "generated, do not edit" comment.

## Acceptance checks
- [x] `pnpm --filter @nova/ui-core tokens` followed by `git diff` shows no change. Editing a value in `tokens.json` makes `pnpm lint` fail until you re-run it.
- [x] Orbit and Relay dev: page background is `#10172A` (dark). Running `document.documentElement.dataset.theme="light"` in the console switches it to `#F5F6F8`. The heading renders in IBM Plex Sans, 26px/600.
- [x] A test class such as `bg-blue-500` produces no CSS (default palette removed).
- [x] `pnpm test` runs the ui-core tests. Definition of done in `AGENTS.md` §9.

## Out of scope
- Storybook, shadcn/ui, any component, a theme toggle UI, a lint rule for hex values, changes to `tokens.json`.

## Questions

## Handoff
**Done:** Implemented theme pipeline (tokens generator, CSS variables, Tailwind v4 theme, fonts, data-theme switch).
**Files changed:**
- `docs/STRUCTURE.md`, `docs/tasks/BOARD.md`, `docs/tasks/NOVA-002.md`
- `frontend/packages/ui-core/package.json`, `tsconfig.json`, `src/index.ts`
- `frontend/packages/ui-core/scripts/build-tokens.ts`, `vitest.config.ts`
- `frontend/packages/ui-core/src/theme/{tokens.css,tailwind-theme.css,styles.css,theme.ts,theme.test.ts,tokens.test.ts}`
- `frontend/vite.aliases.ts`, `frontend/vitest.config.ts`, `frontend/pnpm-lock.yaml`
- `frontend/apps/nova-orbit/{package.json,vite.config.ts,index.html,src/main.tsx,src/App.tsx}`
- `frontend/apps/nova-relay/{package.json,vite.config.ts,index.html,src/main.tsx,src/App.tsx}`
**Commands run:** lint / typecheck / test / build → all pass? yes
**Checked:** 360px ✓ · desktop ✓ · dark ✓ · light ✓
**New dependencies:** tailwindcss@4.3.3, @tailwindcss/vite@4.3.3, @fontsource/ibm-plex-sans@5.3.0, @fontsource/ibm-plex-mono@5.3.0.
**Maps updated:** STRUCTURE.
**Deviations from task:** none.
**Known gaps:** none.

## Review
**Result:** done
**Fixed directly (review: commits):**
- Work was left uncommitted on the branch; committed as-is before review (fce15e5).
- `styles.css`: body hardcoded `15px / 1.5 / 400`; now `@apply bg-bg-ground text-text-primary font-sans text-body` (token-only).
- `tokens.test.ts`: typed the parsed `tokens.json` (was implicit `any`).
- `ui-core/package.json`: removed trailing blank line.
**Verified:** `tokens` re-run gives no diff; lint/typecheck/test (13)/build pass; built CSS has `--bg-ground` #10172a/#f5f6f8, `.text-page-title` 26px/600, no default palette.
**Change requests:** none.
**Rulebook issues found:** handoff must be committed on the task branch before `ready-for-review` (add to AGENTS.md §3).
**Follow-up tasks created:** none.
