# NOVA-001 — Monorepo setup

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-001 · **Depends on:** —

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
- [ ] Fresh clone on Windows: `cd frontend && pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- [ ] `pnpm --filter nova-orbit dev` shows "NOVA Orbit"; `pnpm --filter nova-relay dev` shows "NOVA Relay".
- [ ] No hex colours, no UI libraries installed yet (Tailwind, shadcn come in NOVA-002/007).
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Tailwind, theme, Storybook, any component, any routing, any backend folder.

## Questions

## Handoff

## Review
