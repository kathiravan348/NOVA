# NOVA-081 — Broker: Kite login finished with the passphrase; Kite keys leave `.env`

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-081 · **Depends on:** NOVA-080, NOVA-083 (README overlap)

## Goal
The daily login uses the account's own Kite app. After Kite, Relay sends the passphrase to finish the login,
and the secret is opened only for that request. `NOVA_KITE_API_KEY/SECRET` and the duplicated broker CLI
commands are gone (D55 points 2, 4, 5). Merge together with NOVA-082: between them the login cannot finish.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D39, D55; `docs/tasks/NOVA-080.md` (vault, `broker_kite_apps`)
- `backend/services/broker/src/nova_broker/{kite,accounts,deps,main,internal,recorder_loop,cli,settings}.py`
- `backend/services/broker/tests/conftest.py`, `backend/libs/nova_testing/src/nova_testing/kite.py`

## Files
Create:
- `backend/services/broker/src/nova_broker/pending_login.py`, `tests/test_login_finish.py`
Modify:
- `backend/services/broker/src/nova_broker/{kite,accounts,deps,main,internal,recorder_loop,cli,settings}.py`
- `backend/services/broker/tests/{conftest,test_login,test_internal,test_recorder_loop,test_accounts}.py`;
  delete `tests/test_profiles_cli.py` cases for removed commands (keep the rest)
- `.env.example`, `compose.yaml`, `backend/README.md`, `README.md`, `docs/guides/API.md`

## Build
1. `KiteClient(api_key, transport)`; `exchange(request_token, api_secret)` takes the secret per call.
   `app.state.kite` becomes `app.state.kite_transport`; a dependency builds a client from an account's
   `broker_kite_apps.api_key`. `active_session` returns `(account_id, api_key, access_token)`;
   `internal.py` and `RecorderLoop` use that key (the loop no longer takes `api_key` from settings).
2. `GET /broker/accounts/{id}/login`: 400 "Save the Kite API key and secret first" when the app has no keys.
3. Callback: on success keep the request token in Redis `broker:pending_login:{account_id}` (EX 120) and
   redirect to `{relay}/broker/{id}?kite=finish`; failures redirect to `?kite=failed` (audit as today).
4. `POST /broker/accounts/{id}/login/finish` (`KitePassphrase`) → 200 `BrokerAccount`:
   no pending token → 400 "Login expired: log in to Kite again"; wrong passphrase → 400 "Wrong passphrase"
   (counter `broker:pending_login_tries:{id}`, the 5th wrong try deletes the pending login); then exchange,
   check `user_id`, save the sealed token, delete the pending keys, audit `broker.login` (success or failure).
   The secret and passphrase live only in local variables; never logged or put in errors.
5. Settings: remove `kite_api_key`, `kite_api_secret` (and from `.env.example`, both Compose services).
6. CLI: remove `add-account` and `record-ticks`; keep `new-token-key` and `recorder`. Update READMEs.
7. Tests save keys through `vault.seal` in a fixture; no test reads the Kite keys from settings.

## Acceptance checks
- [ ] pytest: login without keys → 400; callback → `?kite=finish` + pending token; finish OK → active session;
      wrong passphrase ×5 → pending dropped; expired → 400; other `user_id` → failed + audit.
- [ ] pytest: instruments/historical and the recorder loop use the active account's own API key.
- [ ] `python -m nova_broker --help` lists only `new-token-key` and `recorder`.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Relay prompt and Kite app card (NOVA-082); Atlas CLI (NOVA-083); the Kite daily reset setting (stays in env).

## Questions

## Handoff
Built by Claude at the Owner's request. All acceptance checks pass.
- `KiteClient(api_key, http)` on one shared pool (`kite_http`, `app.state.kite_http`); `exchange(token, secret)`.
- `pending_login.py` (Redis, 120 s, 5 tries); callback → `/broker/{id}?kite=finish`; `POST …/login/finish`.
- `active_session` returns `ActiveSession(account_id, api_key, access_token)`; internal + recorder use it.
- Settings/env/Compose: no `NOVA_KITE_API_KEY/SECRET`. CLI: `new-token-key`, `recorder` only.
- Tests seal `API_SECRET` with `nova_testing.kite.PASSPHRASE` in the `account_id` fixture.
- Not listed but needed: `tests/test_units.py`, `tests/test_kite_app.py` (fixture now has keys),
  `libs/nova_testing/.../kite.py` (PASSPHRASE), `docs/CONTRACTS.md` (callback note).
- Checks: `backend-check` green (560). Guides: API; READMEs (setup via Relay).

## Review
Self-reviewed. Merged just before NOVA-082 (the login needs its prompt).
