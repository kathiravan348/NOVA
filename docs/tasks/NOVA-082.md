# NOVA-082 — Relay: Kite app card and the passphrase to finish the login

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-082 · **Depends on:** NOVA-081

## Goal
On the account page the Owner sets the Kite API key, secret and passphrase, edits the app details, tests the
passphrase, and finishes each daily login by typing the passphrase (D55). Works in mock and real mode.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D48, D55; the Build sections of `docs/tasks/NOVA-080.md` and `NOVA-081.md`
- `frontend/packages/services/src/{api/relay.ts,queries/relay.ts,queries/keys.ts}`, `frontend/packages/mocks/src/handlers/relay.ts`
- `frontend/apps/nova-relay/src/pages/broker/{AccountDetailPage,AddAccountModal,SessionCard}.tsx`, `pages/overview/LoginPrompt.tsx`

## Files
Create:
- `frontend/apps/nova-relay/src/pages/broker/{KiteAppCard,KiteKeysModal,KiteAppDetailsModal,PassphraseCheckModal,FinishLoginModal}.tsx`
Modify:
- `frontend/packages/services/src/{api/relay.ts,queries/relay.ts,queries/keys.ts,index.ts}`, `api/api.test.ts`, `queries/queries.test.tsx`
- `frontend/packages/mocks/src/handlers/{relay.ts,relay.test.ts}`
- `frontend/apps/nova-relay/src/pages/broker/{AccountDetailPage.tsx,broker.test.tsx}`
- `frontend/apps/nova-relay/src/pages/overview/{LoginPrompt.tsx,overview.test.tsx}`
- `docs/guides/USER-GUIDE.md` (Relay: first-time Kite setup, daily login, §6, §7)

## Build
1. Services: `getKiteApp`, `saveKiteKeys`, `updateKiteApp`, `checkKitePassphrase`, `finishKiteLogin` + hooks;
   saving keys or finishing login invalidates the account and Kite app queries. Mock handlers answer
   statelessly from the mock data (wrong passphrase in mocks: the text `wrong`, for tests and stories).
2. `KiteAppCard` on the account page, under the session card: **API key** (…AB12 or **Not set**),
   **API secret** (**Saved, locked by your passphrase** or **Not saved**), plan, renews on, redirect URL (mono,
   with the note "Paste this into your Kite app"), postback URL, static IP. Buttons **Set key and secret**,
   **Edit details**, **Test passphrase** (the last only when a secret is saved).
3. `KiteKeysModal`: API key, API secret, passphrase, confirm passphrase (password inputs,
   `autoComplete="new-password"`, ≥ 12 characters, must match). Warning text: "NOVA cannot recover this
   passphrase. If you forget it, enter the key and secret again." When keys exist: "Saving a new key logs
   this account out of Kite." Clear every field on close and after saving.
4. `KiteAppDetailsModal`: plan, renews on (date), postback URL, static IP (the contract's Zod rules).
5. `FinishLoginModal`: opens when the URL has `?kite=finish`: passphrase + **Finish login**. OK → toast
   "Kite connected", URL cleared. Wrong passphrase → inline error, stays open. Expired → toast and close.
6. `LoginPrompt`: when the account's app has no keys, show **Set up the Kite app** (link to the account page)
   instead of **Log in to Kite**.

## Acceptance checks
- [ ] Tests: set keys (mismatch and short passphrase blocked), edit details, test passphrase right/wrong;
      `?kite=finish` → wrong then right passphrase → "Kite connected"; expired → toast; LoginPrompt without keys.
- [ ] No passphrase or secret appears in query caches, URLs, local/session storage or console output.
- [ ] Real mode against the stack: set keys, log in to Kite, finish with the passphrase, session active.
- [ ] Checked at 360px and desktop, dark and light. Definition of done in `AGENTS.md` §9.

## Out of scope
- Changing the passphrase without the secret; family members' accounts; backend changes.

## Questions

## Handoff

## Review
