# NOVA-049 — Broker service: Kite login, encrypted tokens, session expiry, accounts + profiles

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-049 · **Depends on:** NOVA-048

## Goal
The broker service (the only code that talks to Kite, D35) serves broker accounts with their derived session status
and the broker profile, runs the daily Kite login (redirect → callback → token exchange), stores the access token
encrypted until 06:00 IST, and records login and expiry in the audit log (D39). Tests never reach Kite.

## Read first
- `AGENTS.md` (§8, §10), `docs/DECISIONS.md` (D27, D28, D35, D37, D38, D39), `docs/PLAN.md` (R4)
- `frontend/packages/contracts/src/broker.ts`, `frontend/packages/mocks/data/{brokerAccounts,brokerProfiles}.json`
- `backend/services/core/src/nova_core/{main.py,gateway.py,deps.py}`, `backend/libs/nova_db/src/nova_db/models/broker.py`

## Files
Create: `backend/services/broker/{pyproject.toml,src/nova_broker/{__init__.py,py.typed,settings.py,kite.py,crypto.py,
login_state.py,sessions.py,accounts.py,profiles.py,cli.py,__main__.py,main.py,data/zerodha.json},tests/*}`,
`backend/libs/nova_common/src/nova_common/internal.py`, `backend/libs/nova_db/src/nova_db/web.py`,
`backend/libs/nova_contracts/src/nova_contracts/broker.py` + `tests/test_broker.py`, `nova_testing/kite.py` (`FakeKite`),
`nova_broker/deps.py`, `nova_common/settings.py` (`env_ignore_empty`)
Modify: `nova_core/{gateway.py,deps.py}` (+ gateway test: `Location` passes through), `nova_contracts/__init__.py`,
`backend/pyproject.toml`, `uv.lock`, `compose.yaml`, `.env.example`, `docs/{CONTRACTS,DECISIONS,STRUCTURE}.md`, `backend/README.md`

## Build
1. Pydantic `BrokerSession` (both refinements), `BrokerAccount`, `BrokerLink` (https only), `BrokerProfile`; parity vs mocks.
2. `KiteClient(api_key, api_secret, transport)`: `login_url(state)`, `exchange(request_token)` (POST `/session/token`,
   checksum = sha256(key + request_token + secret), header `X-Kite-Version: 3`), `invalidate(token)`. Kite error JSON →
   `KiteError`. No other endpoints; nothing about orders.
3. `TokenCipher` (Fernet, key `NOVA_BROKER_TOKEN_KEY`); `login_state`: `sign(account_id)` / `verify(state)` HMAC, 10 min.
4. Status: no token → `not_logged_in`; `expires_at` ≤ now → `expired` (write `broker.session_expired` once per
   expiry); else `active`. Expiry = next 06:00 IST after login.
5. Routes (internal token required, `nova_common.internal`): `GET /broker/accounts`, `/broker/accounts/{id}`,
   `GET /broker/accounts/{id}/login` → 302 to Kite, `GET /broker/kite/callback` → exchange, check Kite `user_id` =
   account `client_id`, save, audit `broker.login`, 302 to `NOVA_RELAY_URL/accounts/{id}?kite=connected` (or `kite=failed`).
   `GET /broker/profiles`, `/broker/profiles/{broker}` from `data/zerodha.json` + settings (key: last 4 only).
6. CLI `python -m nova_broker add-account --label --client-id`. Compose `broker` service (no host port); core gets
   `NOVA_BROKER_URL`. Gateway forwards `Location`.

## Acceptance checks
- [x] Tests with a fake Kite: login redirect, callback success/failed state/wrong user, token stored encrypted,
      expiry at 06:00 IST, one expiry audit, profile last-4, 401 without internal token.
- [x] `backend-check` passes; `docker compose up -d` starts broker; `/api/v1/broker/accounts` works through Core.

## Out of scope
- Rate limiter and rate-limit endpoints (050), market data (051), any order endpoint (Phase 3), Relay real mode (058).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). Broker service with fake-Kite tests; Compose `broker` (no host port).
**Commands run:** `backend-check` pass (141 tests); e2e through Core: create-admin → add-account → login → accounts
(`not_logged_in`) → profiles `[]` → login start 500 "not configured" (no Kite key yet). Test rows removed.
**New dependencies:** cryptography 50.0.1 (Fernet, D39).
**Deviations:** `FakeKite` lives in `nova_testing.kite` (typed fixture, reusable by NOVA-050/051). Settings ignore empty
env values (Compose passes `""` for unset optional Kite variables). Profile is written to `broker_profiles` at start-up
from `data/zerodha.json` + settings, and only when an API key is set.
**Known gaps:** real Kite login needs the Owner's API key/secret, a token key and the redirect URL registered in the
Kite console (`.env.example`); Relay starts using it in NOVA-058.

## Review
**Result:** done
**Fixed directly:** gateway now passes `Location` (redirects were losing their target); a placeholder checksum
assertion in `test_units.py` replaced with the real SHA-256; login start refuses when no token key is set, so a login
can never succeed with nowhere to store the token.
**Rulebook issues found:** none (no order code: `test_kite_client_has_no_order_code`). **Follow-up tasks created:** none.
