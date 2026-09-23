# NOVA-022 — Scope freeze and Stage B plan

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-022 · **Depends on:** NOVA-041

## Goal
Owner feedback on review round 2 is applied, Stage A scope is frozen, open decisions are closed or
parked with an owner, and Stage B is planned with the first tasks ready to build.

## Read first
- `AGENTS.md`, `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/REVIEW-GUIDE.md` §3–4, `docs/ARCHITECTURE.md`

## Files
Modify: `AGENTS.md` (§1, §4, §5, §8, §9, §10), `GEMINI.md` (step 5), `docs/PLAN.md`, `docs/DECISIONS.md`,
`docs/ARCHITECTURE.md` (contracts line), `docs/tasks/BOARD.md`
Create: `docs/tasks/NOVA-022.md`, `NOVA-043.md`, `NOVA-044.md`, `NOVA-045.md`

## Owner feedback (round 2, 2026-09-23)
"All good": R1–R4 and the open round 1 items accepted with no changes.

## Outcome
- D31 scope freeze; D32 pagination (closes D21); D33 backend tooling; D34 contract parity; D35 Kite access.
- Pending: options data vendor (before options engine), Kite daily reset (NOVA-050), job queue library
  (NOVA-051), family roles (after Phase 1, D12), domain/trademark (Owner).
- AGENTS.md now describes Stage B; §10 corrected (live trading is Phase 3, not 5).
- Stage B plan in `PLAN.md`: tasks 043–059. Planned: 043, 044 (backend lane), 045 (frontend lane, parallel).

## Acceptance checks
- [x] Every open item from `REVIEW-GUIDE.md` §4 is decided or listed under Pending with a task or owner.
- [x] Board lists Stage B tasks; 043–045 have task files with exact `Files` lists and no overlap.

## Review
**Result:** done (Claude + Owner planning task; docs only, no code).
