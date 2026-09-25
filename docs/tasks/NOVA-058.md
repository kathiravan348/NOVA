# NOVA-058 — Real mode: sign-in and Relay screens on the real API

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-058 · **Depends on:** NOVA-046, NOVA-050, NOVA-051

## Goal
`pnpm --filter nova-relay dev:real` runs Relay against NOVA Core: real sign-in/out with the session cookie, real
accounts, broker profile, rate limits (editable), data jobs and audit, and the daily Kite login (D48). Mock mode stays
the default and unchanged. Orbit gets the same sign-in; its screens switch in NOVA-059.

## Read first
- `AGENTS.md` (§6, §7), `docs/DECISIONS.md` (D22, D23, D38, D39, D48), `docs/CONTRACTS.md`
- `frontend/packages/services/src/{config.ts,http.ts,session.ts}`, `frontend/apps/nova-relay/src/{layout,pages}/`

## Files
services `src/{config.ts,http.ts,session.ts,api/relay.ts,index.ts}` + tests; mocks `src/handlers/{orbit.ts,orbit.test.ts}`;
ui-core `LoginForm/{LoginForm.tsx,LoginForm.stories.tsx,LoginForm.test.tsx}`; both apps `{vite.config.ts,package.json,
src/pages/LoginPage.tsx,src/layout/AppLayout.tsx}`; Relay `src/pages/{overview/LoginPrompt.tsx,accounts/AccountDetailPage.tsx,
rate-limits/EditLimitsModal.tsx}` + tests; `README.md`, `docs/DECISIONS.md`, `.claude/launch.json` (`nova-relay-real`)

## Build
1. `getApiBaseUrl()` = same origin in both modes. `vite --mode real` sets `VITE_DATA_MODE=real` and proxies `/api`
   to `NOVA_API_URL` (default `http://127.0.0.1:8000`); scripts `dev:real` in both apps.
2. `apiPost(path, body, schema)`; any 401 calls a registered handler that clears the session.
3. Real `signIn(email, password)` → `POST /auth/login` (`LoginRequest` → `User`); `signOut()` → `POST /auth/logout`
   then clear (clears even if the call fails). Mock mode unchanged. MSW handlers for both endpoints.
4. `LoginForm` props `identifierLabel` (default "Username") and `identifierType`; real mode shows "Email", no demo hint.
5. `DemoBanner` only in mock mode. Relay: "Log in to Kite" → `location.assign(brokerLoginUrl(id))` in real mode;
   account page shows a toast for `?kite=connected|failed` and clears it; rate-limit save toast drops "(demo)".

## Acceptance checks
- [x] Tests: real-mode sign-in/out and 401 expiry (MSW), mock mode unchanged, LoginForm label, Kite button target.
- [x] Manual: stack up + `dev:real` → sign in, see accounts/limits/audit from the database, edit a limit (audited).
- [x] `pnpm review:check` passes. Definition of done in `AGENTS.md` §9.

## Out of scope
- Orbit screens (059), a production build/reverse proxy (VPS), remember-me, password reset.

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). Real sign-in/out, 401 expiry, `dev:real` + `/api` proxy,
Kite login navigation and result toast, demo wording only in mock mode.
**Commands run:** `pnpm review:check` pass (92 files). Manual: stack up + Relay `dev:real` → real-mode sign-in page
(Email, no demo banner); through the Relay origin: login sets `nova_session` → accounts from DB → PATCH limit 204 →
audit "orders per day: 4,500 → 4,200" → Kite start 500 "not configured" → logout 204. Test rows removed afterwards.
The browser sign-in itself was left to the Owner (Claude does not type passwords into forms).
**New dependencies:** none. **Deviations:** REVIEW-GUIDE not changed (README has the real-mode steps).
**Known gaps:** Orbit screens still mock-only in behaviour (059).

## Review
**Result:** done
**Fixed directly:** the `?kite=` toast effect looped forever (the toast changes its own context) — guarded with a
ref; caught by the new test hanging. Stage A "refuses real mode" tests replaced by real-mode tests.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
