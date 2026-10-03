# NOVA-180 — Relay Live Config: indices to record; Pick top leaves room for them (D84)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-180 · **Depends on:** NOVA-179 (merge after it is deployed)

## Goal
On Relay **Live → Config** the Owner chooses which indices the recorder records next to the stocks, and
**Pick top** fills only the slots the indices leave free, so stocks + indices never pass Kite's 3,000.

## Read first
- `AGENTS.md` §6, §7a; `docs/DECISIONS.md` D75, D81, D84; `docs/tasks/NOVA-179.md` (the API change)
- The live page files below; `frontend/packages/services/src/queries/marketData.ts` (`useMarketIndices`)

## Files
Create:
- `frontend/apps/nova-relay/src/pages/live/RecorderIndicesModal.tsx`
Modify:
- `frontend/apps/nova-relay/src/pages/live/RecorderCard.tsx`, `RecorderSymbolsModal.tsx`, `config.test.tsx`
- `docs/guides/USER-GUIDE.md` (Live → Config)

## Build
1. **RecorderCard**: the summary reads e.g. `2,981 chosen stocks + 19 indices` (`no indices` when empty) and gets
   a second button **Choose indices** next to the stocks button. The on/off switch keeps sending only
   `enabled` + `symbols` (absent `indices` keeps them, NOVA-179).
2. **RecorderIndicesModal** (`Modal`, title **Indices to record**): one checkbox per index from
   `useMarketIndices()` (name + member count), **Select all** / **Clear**, a line
   `Stocks + indices: 2,981 + 19 = 3,000 of 3,000`, **Save indices** → `PUT /broker/recorder` with
   `{enabled, symbols, indices}`. Over 3,000 → the Save button is disabled and an alert says
   `Kite streams at most 3000 instruments: remove stocks or indices`. Server errors show as today (`failed`).
   Help text: "Index prices give backtests the market direction. They use a few of the 3,000 slots."
3. **RecorderSymbolsModal**: the limit for stocks becomes `3000 − settings.indices.length`: **Pick top** picks
   that many, the button reads `Pick top <n> by traded value`, and the too-many alert counts the indices.
4. Tests (`config.test.tsx`, mock mode): choosing 19 indices saves them; Pick top then saves 2,981 stocks; a
   3,000-stock list + 1 index shows the alert and disables Save; the switch keeps the indices.
5. User guide: Live → Config explains **Choose indices**, why indices take slots, and to press **Pick top**
   again after adding indices.

## Acceptance checks
- [ ] The four tests above pass; the card and modal render at 360px and desktop, dark and light.
- [ ] With the backend deployed (NOVA-179): saving 19 indices + Pick top + Save gives 3,000 instruments, and
      `GET /broker/recorder` returns the indices.
- [ ] `pnpm review:check` passes.

## Out of scope
- Backend and contracts (NOVA-179). Showing index ticks anywhere (Monitor, Recorded data) — later.
- New ui-core components: use `Modal`, `Checkbox`, `Button` as they are.

## Owner step after deploy (weekend or after 15:45 IST)
Live → Config → **Choose indices** → **Select all** → **Save indices**; then **Choose stocks** → **Pick top** → **Save stocks**.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** ChatGPT built the screen, tests and guide (uncommitted when it went down); Claude committed that work at
takeover (Owner allowed, 4 Oct), merged main and finished it.
**Files changed (takeover):** `RecorderCard.tsx` and the save toast say `1 index` / `n indices`; the dialog's count
line explains "every stock synced with Kite" when no stocks are chosen (was `0 + 1 = 1 of 3,000`); `config.test.tsx`.
**Commands run:** Relay tests 174/174; full `pnpm review:check` green (140/140 files, builds).
**Checked:** demo preview of Live → Config: card, **Choose indices**, select + save, at 360 px and desktop, dark and light.
**New dependencies:** none. **Maps updated:** none. **Guides updated:** USER-GUIDE (Live → Config, what-if row).
**Deviations from task:** none. **Known gaps:** none.

## Review
**Result:** done (4 Oct 2026).
**Reviewer / built by:** Claude / ChatGPT + Claude (takeover). **Self-review:** yes (Owner asked Claude to finish 180).
**Acceptance:** indices saved; Pick top then picks 2,981 and the card shows `2,981 chosen stocks + 19 indices`;
3,000 stocks + 1 index shows the alert and disables Save; the switch keeps the indices (all in `config.test.tsx`).
**Guides checked:** USER-GUIDE Live → Config text and the what-if row match the screen.
**Owner step:** Live → Config → **Choose indices** → **Select all** → **Save indices**, then **Choose stocks** →
**Pick top 2981 by traded value** → **Save stocks** (needs the real Relay, before Monday 09:00).
**Rulebook issues found:** none. **Follow-up tasks created:** none.
