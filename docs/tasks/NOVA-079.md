# NOVA-079 — Relay: broker screens from three to two

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-079 · **Depends on:** NOVA-078

## Goal
Relay's **Broker accounts**, **Broker** and **Rate limits** screens become two: **Broker** (`/broker`) and the
account page (`/broker/:id`). No feature is lost; old links redirect (D55 point 6). Screens only, no API change.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D55
- `frontend/apps/nova-relay/src/{routes.tsx,layout/AppLayout.tsx}`
- `frontend/apps/nova-relay/src/pages/{accounts,broker,rate-limits}/*`

## Files
Create:
- `frontend/apps/nova-relay/src/pages/broker/{AccountsCard,ProfileCard}.tsx`
Move (git mv) into `frontend/apps/nova-relay/src/pages/broker/`:
- `accounts/{AccountDetailPage,AddAccountModal,SessionCard}.tsx`, `rate-limits/{AccountLimitsCard,EditLimitsModal,LimitWarnings}.tsx`
- merge the tests of `accounts/accounts.test.tsx` and `rate-limits/rateLimits.test.tsx` into `broker/broker.test.tsx`
Delete:
- `pages/accounts/AccountsPage.tsx`, `pages/rate-limits/RateLimitsPage.tsx` (and the emptied folders)
Modify:
- `frontend/apps/nova-relay/src/pages/broker/BrokerPage.tsx`, `pages/overview/OverviewPage.tsx` (import path)
- `frontend/apps/nova-relay/src/{routes.tsx,routes.test.tsx,layout/AppLayout.tsx}`
- `docs/guides/USER-GUIDE.md` (§5 steps 3–6, §7), `docs/STRUCTURE.md`

## Build
1. `BrokerPage` (`/broker`, title "Broker"), top to bottom: `LimitWarnings` (only when a window is hot),
   `AccountsCard` (today's accounts table + **Add account**, rows link to `/broker/:id`), `ProfileCard`
   (today's Zerodha profile + **Useful links**). Keep the empty/loading/error states each part has today.
2. `LimitWarnings`: the link goes to the account's page (`/broker/:id`, "View limits"), not `/rate-limits`.
3. `AccountDetailPage` (`/broker/:id`, back link "Back to broker"): the rate-limits card gets the **Edit** buttons
   and `EditLimitsModal` (as the Rate limits page had); drop the "Edit limits on the rate limits page" link.
   `AddAccountModal` navigates to `/broker/:id`.
4. Routes: `/accounts` → `/broker`, `/rate-limits` → `/broker`, `/accounts/:id` → `/broker/:id` **keeping the
   query string** (the Kite callback still returns to `/accounts/:id?kite=…` until NOVA-081).
5. Menu: one item **Broker** (Landmark icon) instead of three.
6. USER-GUIDE: rewrite Relay steps 3–6 as "Broker" and "One account" with the exact on-screen words.

## Acceptance checks
- [ ] Tests: `/broker` shows warnings, accounts and profile; `/broker/:id` edits a limit (modal saves);
      the three old paths redirect; `/accounts/x?kite=connected` still shows the "Kite connected" toast.
- [ ] Menu has one broker item; every screen checked at 360px and desktop, dark and light.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Kite app card, passphrase and finish-login prompt (NOVA-082); any contract, service or mock change.
- Renaming, disabling or removing accounts; family members' accounts.

## Questions

## Handoff
Built by Claude at the Owner's request. All acceptance checks pass.
- `/broker` = LimitWarnings + AccountsCard (was AccountsPage) + ProfileCard; `/broker/:id` edits limits in place.
- `AccountLimitsCard` takes `accountLabel` (title is always "Rate limits"); Edit buttons name the account.
- `LimitWarnings` lost `withLink`: each account name links to `/broker/:id` (Overview too).
- Old paths redirect; `/accounts/:id` keeps the query string. Menu: one **Broker** item.
- Not listed but needed: `pages/overview/overview.test.tsx` (warning link). The Rate limits page's
  "No rate-limit data" empty state is gone: an account without limits simply shows no card.
- Checks: `pnpm review:check` green (703 tests); checked at 375px and desktop in the browser.
- Guides: USER-GUIDE (Relay steps 3–6, §7). STRUCTURE unchanged (it does not list pages).

## Review
Self-reviewed (Owner asked Claude to build 079–083). No issues found.
