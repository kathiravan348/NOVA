# NOVA-199 — Approvals batch test: cheap toolbar lookups (flaky test fix)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-199 · **Depends on:** —

## Goal
`approvalBatch.test.tsx` ("… processes 50 selected requests once after one confirmation") stops timing out when the
full suite runs beside Docker work (seen in NOVA-177, 179, 182).

## Read first
- `AGENTS.md` §8; `frontend/apps/nova-relay/src/pages/approvals/approvalBatch.test.tsx`

## Files
Modify:
- `frontend/apps/nova-relay/src/pages/approvals/approvalBatch.test.tsx`

## Build
1. Measured (alone, 50 rows): the 50 decisions take ~6 ms each (0.3 s) and the dialog closes 0.3 s later, but each
   `screen.getByRole("button", { name })` on the toolbar takes ~2.4 s: it walks the accessibility tree of every
   row (desktop table + mobile cards). Two such lookups made each test ~5–7 s, > 29 s on a busy machine.
2. The `chooseAll` helper finds the two toolbar buttons with `getByText(text, { selector: "button" })` (same
   element: the label is the button's own text). Every assertion stays; no app change.

## Acceptance checks
- [x] The two 50-request tests take under 2 s each alone (was ~7 s).
- [x] Full `pnpm review:check` passes while `docker compose run --rm backend-check` runs at the same time.
- [x] No test deleted or weakened; the other approvals tests are unchanged and pass.

## Out of scope
- App changes (a memoized table was tried: only 7 → 5.3 s, so not kept), DataTable, services. Guides: none.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** cheap toolbar lookups in the batch test helper; cause measured (see Build 1).
**Files changed:** `approvalBatch.test.tsx` only.
**Commands run:** approvals tests 15/15 (50-request tests 1.7 s / 1.4 s, were 6.9 s / 7.0 s); full `pnpm review:check`
green (140/140 files; this file 12.8 s) while backend-check ran in parallel.
**Checked:** no screens. **New dependencies:** none. **Maps updated:** none. **Guides:** none.
**Deviations from task:** the first plan changed `ApprovalList.tsx`; measurement showed the test lookups were the cost, so the task was rewritten to a test-only fix.
**Known gaps:** other tests on large tables may have the same `getByRole` cost; none fail today.

## Review
**Result:** done (4 Oct 2026).
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner asked Claude to do this task here).
**Checks:** as in Handoff. The helper returns the same `<button>` elements (`Button` renders its label as direct
children), the dialog and all result assertions are unchanged, so nothing is weakened.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
