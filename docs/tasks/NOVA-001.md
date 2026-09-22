# NOVA-001 — Monorepo setup

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-001 · **Depends on:** —

## Goal
An empty but working frontend monorepo where `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all pass on Windows.

## Read first
- `AGENTS.md`
- `docs/STRUCTURE.md`

## Files
Create:
- `.gitattributes` (`* text=auto eol=lf`), `.gitignore` (node_modules, dist, .env*, coverage, storybook-static)
- `.editorconfig`, `.nvmrc` (Node 20 LTS or newer LTS)
- `frontend/package.json` (private, scripts: lint, typecheck, test, build, format), `frontend/pnpm-workspace.yaml` (`packages/*`, `apps/*`)
- `frontend/tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, path aliases `@nova/*`)
- `frontend/eslint.config.js` (typescript-eslint, react, react-hooks, jsx-a11y), `frontend/.prettierrc`
- `frontend/vitest.workspace.ts`
- Empty packages, each with `package.json`, `tsconfig.json`, `src/index.ts`: `ui-core`, `ui-trading`, `contracts`, `services`, `mocks` (names `@nova/<folder>`)
- Apps `apps/nova-orbit` and `apps/nova-relay`: Vite + React + TS, each rendering only a heading with the product name from `brand.config.ts`
- One smoke test per app (renders the heading)

Modify:
- `docs/STRUCTURE.md` only if the real layout differs.

## Build
1. Scaffold with pnpm; pin versions in `package.json` (no `latest`).
2. `brand.config.ts` stays at repo root; apps import it via a `@nova/brand` alias.
3. Root `frontend/package.json` scripts run across all workspaces (`pnpm -r`).

## Acceptance checks
- [x] Fresh clone on Windows: `cd frontend && pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- [x] `pnpm --filter nova-orbit dev` shows "NOVA Orbit"; `pnpm --filter nova-relay dev` shows "NOVA Relay".
- [x] No hex colours, no UI libraries installed yet (Tailwind, shadcn come in NOVA-002/007).
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Tailwind, theme, Storybook, any component, any routing, any backend folder.

## Questions

## Handoff

**Done:** Monorepo scaffolded with pnpm workspaces, TS strict, ESLint 9, Prettier, Vitest, packages (`ui-core`, `ui-trading`, `contracts`, `services`, `mocks`), apps (`nova-orbit`, `nova-relay`), and smoke tests.
**Files changed:** .gitattributes, .gitignore, .editorconfig, .nvmrc, frontend/.prettierrc, frontend/.prettierignore, frontend/eslint.config.js, frontend/package.json, frontend/pnpm-workspace.yaml, frontend/tsconfig.base.json, frontend/vitest.workspace.ts, packages/ui-core (package.json, tsconfig.json, src/index.ts), packages/ui-trading (package.json, tsconfig.json, src/index.ts), packages/contracts (package.json, tsconfig.json, src/index.ts), packages/services (package.json, tsconfig.json, src/index.ts), packages/mocks (package.json, tsconfig.json, src/index.ts), apps/nova-orbit (package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/App.test.tsx, src/test/setup.ts), apps/nova-relay (package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/App.test.tsx, src/test/setup.ts).
**Commands run:** lint / typecheck / test / build → all pass (yes)
**Checked:** 360px ✓ · desktop ✓ · dark N/A · light N/A (theming starts in NOVA-002)
**New dependencies:** react@18.3.1, react-dom@18.3.1, vite@6.4.3, vitest@3.2.7, typescript@5.7.3, eslint@9.39.5, prettier@3.9.8, @testing-library/react@16.3.3, jsdom@26.1.0 as specified in tech stack.
**Maps updated:** none (STRUCTURE.md matches workspace exactly).
**Deviations from task:** none.
**Known gaps:** none.

## Review

**Result:** done
**Fixed directly (review: commits):**
- `.nvmrc` 20 → 24: Node 20 is end-of-life (April 2026); 24 is the active LTS.
- `apps/*/index.html`: removed the hardcoded "NOVA …" `<title>` (§1). `main.tsx` already sets it from `brand`.
- `vitest.workspace.ts` → `vitest.config.ts` with `test.projects`, which removes the Vitest 3.2 deprecation warning.
- Both `vite.config.ts` files had the same `@nova/*` alias block. Moved it to a shared `frontend/vite.aliases.ts` (uses `path.join`).
**Change requests:** none.
**Rulebook issues found:** hardcoded brand name in `index.html` (§1), fixed above.
**Follow-up tasks created:** none. Note: aliases live in `tsconfig.base.json` and `vite.aliases.ts`; keep both in sync.
**Verified:** lint, typecheck, test (2/2), build, format:check all pass.
