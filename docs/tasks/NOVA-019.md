# NOVA-019 — Relay: overview + broker accounts (session status, daily login prompt)

**Status:** planned · **Owner:** - · **Branch:** task/NOVA-019 · **Depends on:** NOVA-009, NOVA-013, NOVA-026

## Goal
Relay's Overview (`/`) shows broker session health at a glance with a daily-login prompt and recent activity; `/accounts` lists broker accounts; `/accounts/:id` shows one account and its Kite session.

## Read first
- `AGENTS.md` (§6, §7, §10: no real broker calls), `docs/PLAN.md` (SEBI: daily Kite login)
- `frontend/packages/contracts/src/{broker.ts,audit.ts}`, `frontend/packages/mocks/data/{brokerAccounts,auditEntries}.json`
- `frontend/apps/nova-relay/src/{routes.tsx,layout/AppLayout.tsx,test/setup.ts}`
- Orbit patterns to copy: `frontend/apps/nova-orbit/src/{components/QueryState.tsx,test/renderApp.tsx,lib/format.ts}`

## Files
Create in `frontend/apps/nova-relay/src/`:
- `components/QueryState.tsx`, `test/renderApp.tsx`, `lib/format.ts`, `lib/session.ts`, `lib/session.test.ts`
- `pages/overview/{OverviewPage.tsx,LoginPrompt.tsx,overview.test.tsx}`
- `pages/accounts/{AccountsPage.tsx,AccountDetailPage.tsx,SessionCard.tsx,accounts.test.tsx}`
Modify: relay `package.json`, `src/routes.tsx`, `src/test/setup.ts`; `frontend/pnpm-lock.yaml`

## Build
1. Relay deps (same versions as Orbit): `@tanstack/react-table` 8.21.3, `date-fns` 4.4.0, `date-fns-tz` 3.2.0. Copy Orbit's `QueryState`/`QueryError`, `renderApp` (with `ToastProvider`) and the `ResizeObserver` stub. `lib/format.ts`: `formatIstDate`, `formatIstDateTime`, `formatIstShort` (same as Orbit).
2. `lib/session.ts`: `sessionLabel` (active "Active", expired "Expired", not_logged_in "Not logged in"), `sessionTone` (success / warning / neutral), `needsLogin(account)` = enabled and status ≠ active. Tests.
3. `LoginPrompt` (per account needing login): `Card` with warning icon, "Daily login needed for <label>", text "Kite access tokens expire every day. Log in once each trading day before strategies can use this account.", primary `Button` "Log in to Kite" → toast "Demo only" / "Kite login opens here in Stage B. No broker call was made." (AGENTS §10).
4. `OverviewPage`: `StatCard`s (Accounts, Active sessions, Need login, Disabled — counted from the list); `LoginPrompt` for each `needsLogin` account (none → a success `Card` "All sessions active"); "Recent activity" `Card`: latest 5 audit entries (IST short time, actor, summary) + link "View audit log" (`/audit`).
5. `SessionCard`: `Card` "Kite session": `StatusBadge` + `DescriptionList` (Logged in, Expires, both IST or "—").
6. `AccountsPage`: `DataTable` "Broker accounts": Label (link, primary), Client ID (mono), Broker ("Zerodha"), Status (`Badge` Enabled/Disabled), Session (`StatusBadge`), Expires (IST short, numeric). Loading / error / empty.
7. `AccountDetailPage` (`useBrokerAccount` via `QueryState`, back to `/accounts`): header (label, enabled badge), `DescriptionList` (Broker, Client ID, Created), `SessionCard`, and `LoginPrompt` when `needsLogin`.
8. Routes: index → `OverviewPage`, `/accounts`, `/accounts/:id` (title "Broker account"); rate limits, data jobs, audit stay placeholders (020).
9. Tests (`renderApp`): overview counts match the mocks, shows a prompt for the expired account and the recent activity list; the login button shows the demo toast; accounts list shows 3 rows with session labels; detail of an active account has no prompt; unknown id → Not found.

## Acceptance checks
- [ ] Overview, list and detail at 360px and desktop; dark/light; status never shown by colour alone.
- [ ] No network call leaves the app (MSW only); login is a toast.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Real Kite login/OAuth, token storage, enabling/disabling accounts, rate limits/data jobs/audit pages (020).

## Questions

## Handoff

## Review
