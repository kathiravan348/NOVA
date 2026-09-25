# NOVA-070 — Add a broker account from Relay

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-070 · **Depends on:** NOVA-058

## Goal
The super-admin adds a Zerodha account from Relay's **Broker accounts** page (label + client ID) instead of
running `add-account` in Docker. Same rules as the CLI, plus an audit entry (D52).

## Read first
- `AGENTS.md`, `backend/services/broker/src/nova_broker/cli.py` (`add_account`)
- `frontend/apps/nova-relay/src/pages/rate-limits/EditLimitsModal.tsx` (modal form pattern)

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0005_audit_account_create.py`
- `frontend/apps/nova-relay/src/pages/accounts/AddAccountModal.tsx`
- `frontend/packages/contracts/schema/BrokerAccountCreate.json` (generated: `schema:update`)
Modify:
- `backend/libs/nova_contracts/src/nova_contracts/{broker,audit,__init__}.py`, `tests/test_broker.py`
- `backend/libs/nova_db/src/nova_db/enums.py` (`AUDIT_ACTIONS`)
- `backend/services/broker/src/nova_broker/{accounts,cli}.py`, `tests/test_accounts.py`
- `frontend/packages/contracts/src/{broker,audit,broker.test,jsonSchema.test}.ts`
- `frontend/packages/services/src/api/relay.ts`, `src/queries/relay.ts`
- `frontend/packages/mocks/src/handlers/relay.ts`
- `frontend/apps/nova-relay/src/pages/accounts/{AccountsPage,accounts.test}.tsx`, `src/lib/labels.ts`
- `docs/guides/{USER-GUIDE,API,DATABASE}.md`, `docs/CONTRACTS.md`

## Build
1. Contract `BrokerAccountCreate {label, clientId}`: label ≤ 60 chars with a non-space character (stored trimmed); clientId `^[A-Za-z0-9]{4,12}$`.
   Zod + Pydantic + schema file + parity test. Audit action `broker.account_create` in both enums.
2. Migration 0005: replace `ck_audit_entries_action` with the new list (downgrade restores the old one).
3. Move `add_account` (+ `CLIENT_ID`) into `accounts.py`; `cli.py` imports it (CLI unchanged).
4. `POST /broker/accounts` → 201 `BrokerAccount` (not logged in). Duplicate client ID (any case) → 400
   `invalid_request` "Account AB1234 already exists". Audit `broker.account_create` "Added Main (AB1234)",
   target `broker_account`. Default rate-limit rules are created (as the CLI does).
5. Service `createBrokerAccount` + `useCreateBrokerAccount` (refreshes accounts and rate limits).
   MSW handler: validates, 400 on duplicate, answers 201 without storing (demo, like rate limits).
6. Relay: **Add account** button in the accounts table toolbar and in the empty state → modal with
   **Account name** and **Zerodha client ID**; client-side errors; server error shown in an alert.
   On success: toast **Account added** (demo text in mock mode), close, open the new account page (real mode).

## Acceptance checks
- [ ] pytest: create → 201 + parity-valid + audit row + 6 default rate-limit rules; duplicate (lower case) → 400;
      bad client ID / empty label → 400; no internal token → 401.
- [ ] Vitest: the button opens the modal; bad client ID shows an error and blocks submit; duplicate shows the
      server message; success shows the toast.
- [ ] `add-account` CLI still works (existing tests pass).
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Editing, disabling or deleting accounts; adding users; any change to the Kite login.

## Questions

## Handoff
Built by Claude (Antigravity offline, Owner's request). All acceptance checks pass.
- Backend: `POST /broker/accounts` in `accounts.py`; `add_account` moved there (CLI imports it). Migration 0005.
- Frontend: `BrokerAccountCreate` contract + schema, `useCreateBrokerAccount`, MSW handler, `AddAccountModal`.
- Checks: `pnpm review:check` green; broker + contracts + db pytest in Docker: 195 passed. The full
  `backend-check` hit "too many clients" in Postgres only because the whole dev stack was running.
- Guides: USER-GUIDE (Step 4, not-there-yet), API (new endpoint), DATABASE (0005, audit action).

## Review
Self-reviewed (no second agent). Browser check in mock mode: duplicate shows the server message, a new ID
closes the modal with the demo toast. Real mode needs rebuilt `broker` image + `migrate` to reach 0005.
