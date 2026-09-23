# NOVA-040 — Relay broker page + account detail limits and session countdown

**Status:** done · **Owner:** Claude · **Branch:** main · **Depends on:** NOVA-038

## Goal
A Broker page shows the broker profile (API, plan, renewal, API key last 4, redirect/postback URLs,
static IP, session rule) and useful links from data, opening in a new tab (R4, D28). Account detail
shows the account's limits summary and the time left on its session.

## Files
Create: Relay `pages/broker/{BrokerPage.tsx,broker.test.tsx}`; services `src/clock.ts` (+ test).
Modify: Relay `routes.tsx`, `layout/AppLayout.tsx` (nav "Broker"), `lib/session.ts` (+ test: `timeLeft`),
`pages/accounts/{AccountDetailPage.tsx,SessionCard.tsx,accounts.test.tsx}`; services `src/index.ts`.

## Acceptance checks
- [x] `/broker`: profile facts, `•••• k7Q2` key, "Not registered (needed from Phase 3)" static IP; links
      have `target=_blank`, `rel=noopener noreferrer`, https only; empty and error states.
- [x] Account detail: "Time left" (18 h 00 m for brk_001 at the mock "now"), rate limits card, link to edit.
- [x] services `getNow()`: mock mode uses `DEMO_NOW` (= `MOCK_NOW`, tested) so static data reads consistently.

## Out of scope
- Editing the profile, live countdown ticking, several brokers.

## Handoff
**Done:** Built by Claude directly on `main` (Gemini offline; Owner request 2026-09-23).
**Checked:** Relay + services tests pass (71+); typecheck and lint pass.

## Review
**Result:** done (self-built; no separate review).
