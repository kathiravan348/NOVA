# NOVA-059 — Real mode: Orbit screens on the real API

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-059 · **Depends on:** NOVA-058, NOVA-061, NOVA-062

## Goal
`pnpm --filter nova-orbit dev:real` runs Orbit against NOVA Core: the editor saves strategies and new versions (D43),
the run form queues backtests (D44), and lists, results, compare and market data come from the database (D48).

## Read first
- `AGENTS.md` (§6, §7), `docs/DECISIONS.md` (D43, D44, D47, D48)
- `frontend/apps/nova-orbit/src/pages/{editor,backtests}/`, `frontend/packages/services/src/{api,queries}/orbit.ts`

## Files
services `src/{api/orbit.ts,queries/orbit.ts}` + tests; Orbit `src/pages/editor/{StrategyEditorPage.tsx,editorForm.ts,
PythonFields.tsx,editor.test.tsx}`, `src/pages/backtests/{NewBacktestPage.tsx,backtestForm.ts,backtestForm.test.ts,
backtests.test.tsx}`; `README.md`; `.claude/launch.json` (`nova-orbit-real`)

## Build
1. Services: `createStrategy`, `addStrategyVersion`, `updateStrategy`, `queueBacktest` (validated with the contracts)
   and hooks `useCreateStrategy`, `useSaveStrategyVersion`, `useUpdateStrategy`, `useQueueBacktest` that invalidate
   strategies/stats/backtests.
2. Editor: new → create; existing → new version (note "Saved from the editor") + PATCH when name/description changed.
   Real mode opens the strategy; mock mode keeps the "Draft saved" demo toast. Errors show a danger toast.
3. Run form: `toRunCreate(form)` (capital rupees → paise); real mode opens `/backtests/{id}`, mock keeps its demo.
4. Python template and hint follow D47 (`class Strategy`, `on_bar(self, ctx)` → "enter"/"exit"/None).

## Acceptance checks
- [x] Tests: saves send the right bodies (MSW spy), `toRunCreate` maths, template passes the backend's rules by shape.
- [x] `pnpm review:check` passes; manual real-mode check through the Orbit origin. Definition of done in `AGENTS.md` §9.

## Out of scope
- Required candle date range in the market-data screen (server defaults stay), cancel runs, delete strategies.

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). Editor saves (create / new version / rename), run form queues,
real mode opens the saved strategy or queued run; Python template follows D47.
**Commands run:** `pnpm review:check` pass (92 files). The template passes the backend sandbox. End to end through the
Orbit origin (`dev:real`, stack up, 120 synthetic INFY daily candles seeded in SQL): sign-in → Python strategy
created → run queued → worker completed it in the Linux sandbox: 3 trades, net +₹53,209.09 after ₹3,489.92 charges,
89 equity points; stats and market data served from the database. All test rows removed afterwards.
**New dependencies:** none. **Deviations:** `apiRequest` (POST/PATCH with a JSON answer) generalises `apiPost`.
**Known gaps:** candles still use the server's default range (screen does not send `from`/`to`).

## Review
**Result:** done
**Fixed directly:** the editor's Python template still described the Stage A API (`def on_bar(ctx)` with `ctx.buy()`),
which the sandbox would refuse; rewritten for D47 and checked against the backend.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
