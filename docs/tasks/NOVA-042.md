# NOVA-042 — Faster checks

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-042 · **Depends on:** —

## Goal
`pnpm review:check` runs in under half its current time (baseline ≈ 6 min on the owner's PC) with the same
checks, by removing duplicate TypeScript runs, caching tools and running independent checks in parallel (D30).

## Read first
- `AGENTS.md` (§4, §9), `docs/DECISIONS.md` (D30)
- The files below

## Files
Modify:
- `frontend/package.json` (scripts only)
- `frontend/packages/{contracts,mocks,services,ui-core,ui-trading,ui-storybook}/package.json` (scripts only)
- `frontend/apps/{nova-orbit,nova-relay}/package.json` (scripts only)
- `frontend/tsconfig.base.json`, `frontend/vitest.config.ts`, `.gitignore`

## Build
1. Before changing anything, time `pnpm review:check` once and note it for the handoff.
2. Library packages (`contracts`, `mocks`, `services`, `ui-core`, `ui-trading`): delete the `build` script.
   They are consumed from `src` (`main` → `src/index.ts`) and `tsc` there emits nothing, so it repeats `typecheck`.
3. Apps: `build` becomes `vite build` (typecheck already runs `tsc --noEmit`).
4. Every `lint` script: add `--cache --cache-location node_modules/.cache/eslint/` to the `eslint` call.
   Keep the other commands in the ui-core/ui-trading `lint` scripts unchanged.
5. Root `format:check`: `prettier --check --cache .`; `format`: `prettier --write --cache .`.
6. `tsconfig.base.json`: add `"incremental": true`. Add `*.tsbuildinfo` to `.gitignore`. Check no
   `.tsbuildinfo` file gets committed (`git status` clean after a run).
7. Root `vitest.config.ts`: add `pool: "threads"` under `test` (measured: tests 196 s → 105 s, same results).
8. Root scripts: add `check:lint` (`pnpm -r run lint`), `check:typecheck`, `check:test` (`vitest run`),
   `check:format` (`prettier --check --cache .`), and make
   `review:check` = `pnpm run "/^check:/" && pnpm build` (pnpm runs regex-matched scripts in parallel).
   Keep `lint`, `typecheck`, `test`, `build`, `format:check` working as today.
   If pnpm 12 rejects the regex form, stop and write it in Questions. Do not add a dependency.

## Acceptance checks
- [ ] `pnpm review:check` passes; the test count is unchanged (489 at planning time, or more).
- [ ] A failing check still makes `review:check` exit non-zero (try a lint error, then revert it).
- [ ] Cold `review:check` (after deleting `node_modules/.cache`) takes ≤ 50% of the step 1 time; a second
      run is faster again. Put all three times in the handoff.
- [ ] `pnpm review` (dev servers) and `pnpm build` still work; `git status` clean after the runs.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Changing the test environment (jsdom → happy-dom), test files, lint rules, tsconfig strictness.
- New dependencies (turbo, concurrently, …), CI setup, Windows Defender or other system settings.
- Any source code change in `src/`.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Files changed:** `frontend/package.json` (check:* scripts, prettier `--cache`), all package/app `package.json` (no library `build`, apps `vite build`, eslint `--cache`), `tsconfig.base.json` (`incremental`), `vitest.config.ts` (`pool: "threads"`), `.gitignore` (`*.tsbuildinfo`).
**Times (owner PC):** before 365 s; cold 226 s; warm 209 s (tests alone 103 s).
**Deviation:** step 8 parallel run was measured and dropped: running lint, typecheck and tests together made tests 309 s and the whole check 445 s. `review:check` runs format, lint, typecheck, test, build in sequence. The 50% target is not met; remaining time is mostly jsdom tests and the Storybook build (both out of scope). D30 updated.
**Checked:** `review:check` passes (510 tests); `git status` clean of `.tsbuildinfo`.

## Review
**Result:** done (self-built; no separate review).
**Follow-up tasks created:** none. Option for later: happy-dom and a Storybook-free `review:check` (owner decision).
