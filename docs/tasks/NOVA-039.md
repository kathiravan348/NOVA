# NOVA-039 — Relay rate limits page v2

**Status:** done · **Owner:** Claude · **Branch:** main · **Depends on:** NOVA-038

## Goal
The rate limits page shows, per account, endpoint and window: usage against the own safety limit, the
broker limit, % used and when the counter resets (R3); own limits can be edited (≤ broker limit, demo
toast); windows above 80% are warned about on this page and on the overview.

## Files
Create: Relay `lib/rateLimits.ts` (+ test), `pages/rate-limits/{EditLimitsModal.tsx,LimitWarnings.tsx}`.
Modify: Relay `pages/rate-limits/{AccountLimitsCard.tsx,RateLimitsPage.tsx,rateLimits.test.tsx}`,
`pages/overview/{OverviewPage.tsx,overview.test.tsx}`.

## Acceptance checks
- [x] Each window: meter `used / own limit · %`, own and broker limit, "Resets <IST>" (day) or "Rolling window · peak".
- [x] "Edit limits" per endpoint: one field per window, error above the broker limit, save sends
      `PATCH /broker/rate-limits/{account}/{endpoint}` for changed windows only, then "Limits saved (demo)".
- [x] Warning card (role status) lists windows above 80%, on this page and on the overview (with link).
- [x] "NOVA limit" text comes from `brand.config.ts`.

## Out of scope
- Storing edits in Stage A, real throttling, broker page (NOVA-040).

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Checked:** Relay tests pass (32); typecheck and lint pass.

## Review
**Result:** done (self-built; no separate review).
