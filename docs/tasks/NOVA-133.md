# NOVA-133 — Relay Approvals page, agent view in Relay and Orbit (D67)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-133 · **Depends on:** NOVA-130 (merge after 132)

## Goal
The Owner approves or rejects agent requests and manages the agent account on a new Relay **Approvals** page;
signed in as the agent, both apps show a banner and no broker screens or broker calls.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D67; `docs/COMPONENTS.md`; every file under Files

## Files
Create:
- `frontend/apps/nova-relay/src/pages/approvals/ApprovalsPage.tsx`, `ApprovalList.tsx`, `AgentAccountCard.tsx`,
  `approvals.test.tsx`
Modify:
- `frontend/apps/nova-relay/src/routes.tsx`, `routes.test.tsx`, `layout/AppLayout.tsx`
- `frontend/apps/nova-relay/src/pages/overview/OverviewPage.tsx`, `overview.test.tsx`
- `frontend/apps/nova-relay/src/pages/data-jobs/DataJobsPage.tsx`, `NewDownloadPage.tsx`, `downloads.test.tsx`
- `frontend/apps/nova-orbit/src/layout/AppLayout.tsx`
- `docs/guides/USER-GUIDE.md`

## Build
1. Menu item **Approvals** (after Audit log) with the pending count; route `/approvals`.
2. **Approvals** page, super-admin: **Waiting** list (time, method + path, the JSON body in a mono block,
   **Approve** / **Reject** with a confirm) refreshed every 5 s; **History** (`done`, `failed`, `rejected`,
   `expired`) with the answer status and a short result, **Load more**. Signed in as the agent: the same lists,
   read-only (no buttons).
3. **Agent account** card (super-admin only): none yet → **Create agent** (name, email, password ×2, ≥ 12);
   else name, email, last sign-in, switch **Agent access**, **Set new password**. Errors in the form.
4. Agent view (`session.role === "agent"`): `DemoBanner` text "Agent account: changes wait for Admin approval"
   in both apps (the demo banner still wins in mock mode); Relay hides **Broker**, redirects `/broker*` to `/`,
   and does not render the broker parts of Overview, the rate-limit warnings or the recorder card (no `/broker`
   calls at all). **New download → Back** does not delete the draft for the agent (drafts expire in 24 h).
5. A held change shows the `approval_pending` message through the screen's usual error toast (no per-screen code).
6. USER-GUIDE: new step "Approvals and the agent account" (what the agent can and cannot do, how to approve,
   how to turn access off), and a row in "what do I do if".

## Acceptance checks
- [ ] Tests: approve/reject call the API; agent sees no Broker menu and no `/broker` request is made (MSW);
      agent sees no buttons on Approvals; Back keeps the draft for the agent.
- [ ] 360px and desktop, dark and light. `pnpm review:check` passes. Definition of done (`AGENTS.md` §9).

## Out of scope
- Backend (131, 132). New ui-core components (reuse `DemoBanner`, `Card`, `DataTable`, `Modal`, `Switch`).
- Live push of approvals over `/ws`; green "sent" toasts per screen.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
