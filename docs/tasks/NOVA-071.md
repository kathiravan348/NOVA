# NOVA-071 — Editor: cost averaging fields, detail text, user guide (D53)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-071 · **Depends on:** NOVA-069

## Goal
In the strategy editor the Owner can turn on **Cost averaging** and set **Add every (% fall)** and
**Max extra buys**; the strategy page shows it; the user guide explains it.

## Read first
- `AGENTS.md` (§6, §7a), `docs/DECISIONS.md` (D53), `docs/tasks/NOVA-069.md`
- `frontend/apps/nova-orbit/src/pages/editor/{editorForm.ts,editorForm.test.ts,BasicsFields.tsx,editor.test.tsx}`
- `frontend/apps/nova-orbit/src/lib/{strategyText.ts,strategyText.test.ts}`
- `frontend/apps/nova-orbit/src/pages/strategies/StrategySpecCard.tsx`

## Files
Modify: the 7 files above, `docs/guides/USER-GUIDE.md`

## Build
1. `editorForm.ts`: `averagingOn: boolean` (default false), `averagingDrop: string` ("5"), `averagingMaxAdds: string`
   ("3"). When on: drop > 0 and ≤ 50 ("Between 0 and 50"), max adds whole 1–10 ("Whole number from 1 to 10").
   `fromSpec` fills them from `spec.averaging`; `toSpec` writes `averaging` only when on (so specs without it
   round-trip unchanged). Both modes.
2. `BasicsFields.tsx`, in the sizing and risk area: a **Cost averaging** `Switch` (ui-core); when on, two inputs
   **Add every (% fall)** and **Max extra buys**, with one plain description line under the switch.
3. `strategyText.ts`: `describeAveraging(a?)` → "Off" or "Buy again every 5% fall, up to 3 times";
   `StrategySpecCard` shows it as a row **Cost averaging**.
4. `USER-GUIDE.md` Step 4 item 4: what cost averaging does, that stop-loss/target then use the average buy
   price, and that the backtest shows the whole position as one trade at the average price.

## Acceptance checks
- [ ] Form tests: off by default and no `averaging` in the spec; on with 5 / 3 writes `{dropPercent: 5,
      maxAdds: 3}`; 0, 60, 2.5 adds show errors; every mock spec still round-trips.
- [ ] Editor test: switching it on shows the two fields; the detail page shows the row text.
- [ ] Checked at 360px and desktop, dark and light. `pnpm review:check` passes. AGENTS §9.

## Out of scope
- Backend (NOVA-069). Per-buy details on the trades table.

## Questions

## Handoff
Built by Claude (Antigravity offline). All acceptance checks pass.
- Form: `averagingOn` / `averagingDrop` ("5") / `averagingMaxAdds` ("3"), checked only when on;
  `toSpec` writes `averaging` only when on, so every mock spec still round-trips.
- `BasicsFields`: **Cost averaging** Switch with a one-line description; **Add every (% fall)** and
  **Max extra buys** appear when on. Strategy page: **Cost averaging** row (`describeAveraging`).
- Browser (mock, 360px): fields full-width inside the card, no page overflow.
- Checks: `pnpm review:check` green. Guides: USER-GUIDE Step 4 item 4 (with a worked example).

## Review
Self-reviewed. Example in the guide checked: 100 → 95 → 90.25 → 85.74 (5% each, half-up paise).
