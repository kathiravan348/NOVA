# NOVA-195 — Orbit: intraday strategy form + run form fields (D84)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-195 · **Depends on:** NOVA-183, NOVA-194

## Goal
The Owner creates and edits intraday strategies in Orbit (choose a setup and a buying rule, set their numbers) and
queues an intraday backtest from the run form by choosing a frozen research profile version and a scenario.

## Read first
- `AGENTS.md` §6, §7a; `docs/INTRADAY-RESEARCH.md` §3, §4; `docs/tasks/NOVA-183.md` (spec shape)
- `frontend/apps/nova-orbit/src/pages/editor/StrategyEditorPage.tsx`, `ModeSwitch.tsx`, `editorForm.ts`;
  `pages/backtests/NewBacktestPage.tsx`, `backtestForm.ts`, `DataSourceField.tsx`

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/editor/IntradayFields.tsx`, `editorFormIntraday.ts`, `editorFormIntraday.test.ts`
- `frontend/apps/nova-orbit/src/pages/backtests/ResearchProfileField.tsx`
Modify:
- `frontend/apps/nova-orbit/src/pages/editor/StrategyEditorPage.tsx`, `ModeSwitch.tsx`, `editor.test.tsx`
- `frontend/apps/nova-orbit/src/pages/backtests/NewBacktestPage.tsx`, `EditBacktestPage.tsx`, `backtestForm.ts`,
  `backtestForm.test.ts`, `backtests.test.tsx`
- `docs/guides/USER-GUIDE.md` (strategy editor + new backtest steps)

## Build
1. `ModeSwitch` offers **Intraday setup** (new strategies, and editing an intraday one). Segment, exchange and
   timeframe are fixed (Intraday, NSE, 1 minute) and shown as text. Remove the NOVA-183 "coming soon" notice.
2. `IntradayFields`: **Setup** select (five kinds, plain names: "Opening range retest", …) with each kind's fields
   and defaults; **Buying rule** select (Single entry / Average on recovery / Add to a winner) with its fields;
   each field has a one-line hint (from `docs/INTRADAY-RESEARCH.md`). Saving creates a version as today.
3. Run form, when the chosen strategy version is intraday: data source fixed to **Recorded data**; new fields
   **Research profile** (profile → only frozen versions, "v2 · frozen 4 Oct") and **Scenario** (Base / Stress, with
   the profile's delay and slippage shown). The body sends `profileId`, `profileVersion`, `scenario`. No frozen
   version → a message with a link to **Research plan**. Benchmark stays (default NIFTY 50).
4. Edit backtest (new version) keeps the three fields.

## Acceptance checks
- [ ] Editor tests: create each setup kind with each buying rule; values round-trip `editorFormIntraday`; an
      out-of-range value shows the contract message.
- [ ] Run form tests: intraday strategy → Recorded fixed, profile/scenario required, body correct; a candle
      strategy shows no new fields; no frozen profile → message + link.
- [ ] 360px and desktop, dark and light; `pnpm review:check` passes.

## Out of scope
- Library entries (200), experiments (196), backend checks (185 already refuses bad bodies).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
