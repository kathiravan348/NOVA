# NOVA-198 — Clean slate: delete the old strategies and backtests (D85)

**Status:** planned · **Owner:** — · **Branch:** none (no code) · **Depends on:** NOVA-197 (all D84 tasks done)

## Goal
Orbit starts fresh: every strategy that existed on 3 Oct 2026 (102 drafts, 105 versions) is deleted with all
its backtests, results and trades (204 runs, 63,685 trades on 3 Oct). No summary is kept (Owner choice).

## Read first
- `AGENTS.md` §1 (D76), §10; `docs/DECISIONS.md` D62 (1), D67, D71, D85; `docs/guides/API.md` (`DELETE /strategies/{id}`)
- `.env.agent` (git-ignored): the agent account's sign-in

## Files
None. No code, migration or guide change.

## Build
1. Before starting, show the Owner the list: id, name, created date, run count of every strategy with
   `created_at` on or before 2026-10-03 (IST). Strategies created later (intraday setups, Library entries
   added during D84 work) are **not** deleted unless the Owner names them in chat.
2. If any of those strategies has a run `running`, wait for it or ask the Owner (the API refuses).
3. Sign in as the agent (D67) and send `DELETE /strategies/{id}` for each listed strategy. Each request is held;
   tell the Owner the count so they can **Approve selected** in Relay → Approvals (D71). Held requests expire
   after 30 minutes: send them in batches the Owner can approve in time.
4. After approval, check: `GET /strategies` returns none of the listed ids; `GET /backtests` returns no run of
   them; the audit log shows one `strategy.delete` per strategy (actor = the Owner's approval).

## Acceptance checks
- [ ] Every listed strategy and all of its backtests are gone; later strategies are untouched.
- [ ] Stored candles, recorded ticks, data jobs, the Library and research profiles are unchanged.
- [ ] Board updated; one line in Handoff with the counts deleted.

## Out of scope
- Deleting market data, Library definitions, research profiles or experiments (D84 experiment runs cannot be deleted).
- A bulk-delete endpoint or button. Any summary or export of the deleted results (Owner chose none).

## Questions
_(writes here if blocked)_

## Handoff
_(≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Owner confirms in chat; no code review needed)_
