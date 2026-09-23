# NOVA-041 — Review guide round 2

**Status:** done · **Owner:** Claude · **Branch:** main · **Depends on:** NOVA-034–040

## Goal
`docs/REVIEW-GUIDE.md` walks the owner through the round 1 changes (R1–R4) and collects feedback for the
scope freeze (NOVA-022).

## Files
Modify: `docs/REVIEW-GUIDE.md`; mocks `data/brokerProfiles.json` (redirect URL without the brand name).

## Acceptance checks
- [x] Walkthrough updated for strategy cards, symbol picker, results by symbol, market data list, Broker page,
      account time left, rate limits v2; stays under 150 lines.
- [x] Round 2 checklist per requirement (R1–R4) plus open round 1 items and scope decisions (incl. Kite
      daily reset time).
- [x] Walkthrough checked in the running apps (Orbit strategies, run form picker; Relay rate limits, Broker).

## Out of scope
- Applying the feedback (NOVA-022).

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Checked:** apps opened with `orbit-review` / `relay-review`; `pnpm review:check` passes.

## Review
**Result:** done (self-built; no separate review).
