# NOVA-080 — Broker: Kite app per account, API secret sealed with a passphrase

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-080 · **Depends on:** NOVA-079

## Goal
Each broker account has a Kite app row: API key, API secret sealed with the Owner's passphrase, and app
details, read and changed over HTTP (D55 points 1, 4). Login still uses the env keys until NOVA-081.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D39, D55
- `backend/services/broker/src/nova_broker/{accounts,profiles,settings,crypto,deps}.py`, `rev0005_audit_account_create.py`
- `backend/libs/nova_contracts/src/nova_contracts/broker.py`, `frontend/packages/contracts/src/broker.ts`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0008_kite_apps.py`
- `backend/services/broker/src/nova_broker/{vault,kite_app}.py`, `tests/{test_vault,test_kite_app}.py`
- `frontend/packages/contracts/schema/{KiteApp,KiteAppUpdate,KiteKeysUpdate,KitePassphrase}.json` (generated)
Modify:
- `backend/libs/nova_db/src/nova_db/{enums.py,models/broker.py,models/__init__.py}`, `tests/{test_migrations,test_constraints}.py`
- `backend/libs/nova_contracts/src/nova_contracts/{broker,audit,__init__}.py`, `tests/test_broker.py`
- `backend/services/broker/src/nova_broker/{profiles,settings,main}.py` and the broker tests that build profiles
- `frontend/packages/contracts/src/{broker,broker.test,audit,index,jsonSchema.test}.ts`; `schema/BrokerProfile.json`
- `frontend/packages/mocks/src/{data.ts,schemas.test.ts}`; `frontend/apps/nova-relay/src/pages/broker/ProfileCard.tsx`
- `.env.example`, `compose.yaml` (drop the removed `NOVA_KITE_*` lines), `docs/guides/{API,DATABASE}.md`, `docs/CONTRACTS.md`

## Build
1. Migration 0008: table `broker_kite_apps` — `account_id` PK FK `broker_accounts` ON DELETE CASCADE, `api_key`
   text, `api_secret_sealed` bytea, CHECK both null or both set, CHECK `api_key ~ '^[A-Za-z0-9]{6,64}$'`,
   `plan`, `subscription_renews_on`, `postback_url`, `static_ip` (nullable), `updated_at`. Copy today's profile
   plan/renewal/postback/static IP into a row per existing account; then drop `plan`, `subscription_renews_on`,
   `api_key_last4`, `redirect_url`, `postback_url`, `static_ip` from `broker_profiles`. Audit enum + `broker.kite_app_update`.
2. `vault.py`: `seal(secret, passphrase, account_id) -> bytes` = `0x01 | salt(16) | nonce(12) | AES-GCM
   ciphertext`, key = `hashlib.scrypt(n=2**15, r=8, p=1, maxmem=64 MiB, dklen=32)`, associated data = account
   id; `unseal(...) -> str` raises `WrongPassphrase` on any failure. Never log either value.
3. Contracts (Pydantic + Zod + parity): `KiteApp {accountId, apiKeyLast4|null, secretSaved, plan|null,
   subscriptionRenewsOn|null, redirectUrl, postbackUrl|null, staticIp|null, updatedAt|null}`;
   `KiteKeysUpdate {apiKey, apiSecret (1–128), passphrase (12–128)}`; `KiteAppUpdate {plan (≤ 60)|null,
   subscriptionRenewsOn, postbackUrl, staticIp}` (all nullable); `KitePassphrase {passphrase}`.
   `BrokerProfile` drops the six moved fields. `redirectUrl` = `{NOVA_RELAY_URL}/api/v1/broker/kite/callback`.
4. `kite_app.py` (router under `/broker/accounts/{id}/kite-app`): `GET` → `KiteApp` (empty values when no row);
   `PUT /keys` → seals and saves; if the key changed, clear the account's session; `PATCH` → details;
   `POST /check` → 204, or 400 "Wrong passphrase" / "Save the Kite API key and secret first". 404 unknown account.
   PUT and PATCH audit `broker.kite_app_update` ("Saved Kite keys …AB12 for Primary" / "Updated Kite app details").
5. `profiles.sync_profile` writes broker facts at start-up without needing a key. Remove settings `kite_plan`,
   `kite_renews_on`, `kite_postback_url`, `kite_static_ip`, `kite_redirect_url` and their `.env.example` and `compose.yaml` lines.
6. Mocks: profile without the moved fields, a `KiteApp` per mock account; `ProfileCard` drops the moved rows.

## Acceptance checks
- [ ] pytest: seal/unseal round trip; wrong passphrase, other account id, tampered blob fail; two seals differ;
      GET/PUT/PATCH/check + audit + 400/404; key change clears the session; no response holds the secret;
      migration up/down with a profile + account keeps plan and static IP on the account's row.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Login with these keys, dropping `NOVA_KITE_API_KEY/SECRET` (081); Relay screens (082); family apps; passphrase change without the secret.

## Questions

## Handoff

## Review
