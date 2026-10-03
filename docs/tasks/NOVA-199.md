# NOVA-199 — Approvals batch: one table update per batch (flaky test fix)

**Status:** in-progress · **Owner:** Claude · **Branch:** task/NOVA-199 · **Depends on:** —

## Goal
`approvalBatch.test.tsx` ("… processes 50 selected requests once after one confirmation") stops timing out when the
full suite runs beside Docker work. Cause: after each of the 50 decisions the Approvals list redraws all
remaining rows twice (desktop table + mobile cards), about 2,500 row renders per batch (7 s alone, > 29 s under load).

## Read first
- `AGENTS.md` §8; `docs/DECISIONS.md` D67, D71
- `frontend/apps/nova-relay/src/pages/approvals/ApprovalList.tsx`, `approvalBatch.test.tsx`

## Files
Modify:
- `frontend/apps/nova-relay/src/pages/approvals/ApprovalList.tsx`
- `frontend/apps/nova-relay/src/pages/approvals/approvalBatch.test.tsx`

## Build
1. While a batch runs, each outcome still updates the progress (`done` / `total`) and the outcome list at once.
   Decided ids leave `resolved` and `selected` **once, when the batch ends** (also when it throws), not one by one.
   Matches the user guide: "Progress and individual problems appear afterward".
2. `columns` are memoized (they depend only on `waiting`), and the `DataTable` element is memoized on its real
   inputs, so a progress-only update does not redraw the table.
3. Test: keep every assertion (50 writes, 50 unique ids, selection 0, "Finished: 50 of 50"). Add a check that the
   page shows each finished decision's progress during the batch. Remove the 10 s / 20 s timeout overrides only
   if the test then runs well inside the defaults.

## Acceptance checks
- [ ] The two 50-request tests take under 2 s each alone (was ~7 s).
- [ ] Full `pnpm review:check` passes while `docker compose run --rm backend-check` runs at the same time.
- [ ] No test deleted or weakened; the other approvals tests are unchanged and pass.

## Out of scope
- DataTable (ui-core) changes, the batch hook in `@nova/services`, any API change. Guides: none (behaviour matches
  the user guide text).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
