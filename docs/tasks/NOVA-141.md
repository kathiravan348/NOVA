# NOVA-141 — Compact Approvals with bulk decisions and request details

**Status:** in-progress · **Owner:** ChatGPT · **Branch:** task/NOVA-141 · **Depends on:** NOVA-133

## Goal
Make batches of agent requests easy to inspect and decide without scrolling through full JSON cards.
Owner approved the compact table, bulk selection, details dialog and separate tabs on 28 Sep 2026.

## Read first
- `AGENTS.md`, `CHATGPT.md`, `GEMINI.md`; listed files and existing DataTable/Tabs/Modal/DescriptionList primitives.

## Files
Create:
- `frontend/packages/ui-core/src/components/TextBlock/{TextBlock.tsx,TextBlock.test.tsx,TextBlock.stories.tsx}`
- `frontend/apps/nova-relay/src/pages/approvals/{ApprovalDetails.tsx,ApprovalDecision.tsx,approvalPresentation.ts,approvalBatch.test.tsx}`
Modify:
- `frontend/apps/nova-relay/src/pages/approvals/{ApprovalsPage.tsx,ApprovalList.tsx,approvals.test.tsx}`
- `frontend/packages/services/src/queries/approvals.ts`
- `frontend/packages/ui-core/src/{index.ts,components/DataTable/DataTable.stories.tsx}`
- `docs/{COMPONENTS.md,STRUCTURE.md,guides/USER-GUIDE.md}` (guide: Step 9 and approval troubleshooting only)
- `docs/tasks/{BOARD.md,NOVA-141.md}`

## Build
1. Waiting (default), History and admin-only Agent account tabs. Reuse shared DataTable (10-row pages), search,
   checkboxes and mobile cards; concise request name/action/time/status, details button; no raw JSON in rows.
2. Approve selected / Reject selected counts, clear selection and select all shown, including mobile. One confirmation
   lists the selected request summaries. Freeze the chosen IDs; later arrivals must never join the batch.
3. Services bulk hook calls existing individual endpoints sequentially, with progress and individual outcomes; no
   backend/API/contract changes. Remove decided IDs, retain only still-eligible failed IDs. Never automatically retry.
4. Expired/already-decided requests cannot be selected or submitted. Recheck eligibility at confirmation and during
   the batch; refresh afterward. Disable competing decisions and tab changes while processing. Agent is read-only.
5. Details dialog shows full method/path/query/body, requester, times, status and result. Generic TextBlock owns
   wrapped, scrollable monospace content and stories; all styles use tokens. Preserve agent-account flows.
6. Update maps and user guide; no new dependencies. Existing 30-minute expiry and admin restrictions stay enforced.

## Acceptance checks
- [x] Bulk approve/reject sends only the selected IDs once, after confirmation; 50-row selection works.
- [x] Partial HTTP/upstream failures, expiry during confirmation/batch, refresh, new arrivals and agent restrictions tested.
- [x] Search/paging, full details, separate history/account tabs and existing password/access tests pass.
- [x] New primitive render test and stories; verified 360px/desktop, dark/light, keyboard and no horizontal overflow.
- [x] Affected tests/typecheck/lint pass; `pnpm review:check` passed once before ready-for-review.

## Out of scope
- Backend bulk endpoint, expiry changes, automatic approvals, broker permissions, backtest execution and merging.

## Questions
None.

## Handoff
- Built compact Waiting/History/Agent account tabs, search, paging, selection and full details dialogs.
- Bulk decisions freeze IDs and use sequential existing APIs; progress, partial errors and expiry guards covered.
- Validation: 17 affected tests passed; full frontend review:check passed (format, lint, typecheck, tests, build).
- Visual: app and new stories checked at 360px and desktop in both themes; no horizontal overflow.
- Guides: USER-GUIDE Step 9/troubleshooting; COMPONENTS/STRUCTURE updated. Dependencies: none. Backend: none.
- Independent lead-agent review required; implementation remains on task/NOVA-141.

## Review
Independent lead-agent review pending.
