# NOVA-013 — Login (mock super-admin) + Orbit and Relay app shells with routing

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-013 · **Depends on:** NOVA-006, NOVA-010

## Goal
Both apps boot MSW in mock mode, show a login screen, and after sign-in show an `AppShell` with their nav, `DemoBanner`, theme toggle and sign-out, and placeholder pages for every later screen.

## Read first
- `AGENTS.md` (§6, §7), `docs/DECISIONS.md` (D21–D23), `brand.config.ts`
- `frontend/apps/nova-orbit/{package.json,vite.config.ts,src/*}`, `frontend/vite.aliases.ts`, `frontend/tsconfig.base.json`
- `frontend/packages/ui-core/src/components/{AppShell,NavItem,DemoBanner,ThemeToggle,Input,Button,Card}/*.tsx`
- `frontend/packages/services/src/{index.ts,api/orbit.ts}`, `frontend/packages/mocks/src/handlers/index.ts`

## Files
Create:
- ui-core `src/components/LoginForm/{LoginForm.tsx,LoginForm.stories.tsx,LoginForm.test.tsx}`
- services `src/session.ts`, `src/session.test.tsx`
- mocks `src/browser.ts`; `public/mockServiceWorker.js` in both apps (`pnpm dlx msw@2.15.0 init public`)
- each app (`nova-orbit`, `nova-relay`) `src/`: `routes.tsx`, `layout/AppLayout.tsx`, `layout/RequireAuth.tsx`, `pages/LoginPage.tsx`, `pages/PlaceholderPage.tsx`, `routes.test.tsx`
Modify: both apps `{package.json,src/App.tsx,src/main.tsx,src/App.test.tsx}`, ui-core `src/index.ts`, services `src/index.ts`, `frontend/{vite.aliases.ts,tsconfig.base.json,eslint.config.js,.prettierignore}`, `frontend/pnpm-lock.yaml`, `docs/{COMPONENTS,STRUCTURE,DECISIONS}.md`

## Build
1. Apps depend on `react-router` 7.18.4 (v8 needs React 19), `@tanstack/react-query` 5.103.2, `lucide-react` (ui-core's version).
2. `LoginForm` (ui-core, props only): `title`, `subtitle?`, `hint?`, `error?`, `submitting?`, `onSubmit({ username, password })`. `Card` centred, `Input` username + password (`autoComplete`), primary `Button` "Sign in" (disabled + "Signing in…" while submitting), error in `role="alert"`. Stories: Default, WithError, Submitting, 360px.
3. `session.ts`: `signIn(username, password)` — mock mode: both non-empty (trimmed) else throws `ApiRequestError(401, "unauthorized")` (add `"unauthorized"` to the services-only code union); then `getMe()`; stores `{ userId, displayName }` in `sessionStorage["nova-session"]`. `signOut()`, `getSession()`, `useSession()` (`useSyncExternalStore` + a listener set). Real mode throws like `getApiBaseUrl`.
4. `mocks/src/browser.ts`: `startMockWorker()` = `setupWorker(...handlers).start({ onUnhandledRequest: "bypass", quiet: true })`. Alias `@nova/mocks/browser` (vite + tsconfig). Only apps' `main.tsx` imports it, dynamically, when `getDataMode() === "mock"`.
5. `App.tsx`: `QueryClientProvider` (`createQueryClient()`), `ToastProvider`, `RouterProvider`. `routes.tsx` exports `routes: RouteObject[]` (for `createBrowserRouter` and tests' `createMemoryRouter`): `/login` public; everything else inside `RequireAuth` (redirect to `/login?next=…`) → `AppLayout` → pages.
6. Orbit nav: Strategies `/strategies` (index redirects here), Backtests `/backtests`, Compare `/compare`, Market data `/market-data`. Relay nav: Overview `/`, Broker accounts `/accounts`, Rate limits `/rate-limits`, Data jobs `/data-jobs`, Audit log `/audit`. `NavItem asChild` + `NavLink`, lucide icons.
7. `AppLayout`: `AppShell` with brand from `brand.config.ts`, `banner={<DemoBanner />}`, `actions` = user name + `ThemeToggle` + sign-out `IconButton`, `<Outlet />`. `PlaceholderPage({ title })` = page title + `EmptyState` "Coming in a later task".
8. Tests: `routes.test.tsx` (memory router + MSW node server): signed out → `/login`; sign in → lands on `next` or the index page and shows the nav; sign-out returns to `/login`. `session.test.tsx`: empty password rejected, session stored/cleared, `useSession` re-renders.

## Acceptance checks
- [ ] `pnpm --filter nova-orbit dev` / `nova-relay dev`: login → shell → every nav link opens its page; reload keeps the session; sign-out works; 360px menu works; dark/light.
- [ ] No brand strings hardcoded (only `brand.config.ts`); no `@nova/mocks` import outside `main.tsx` and tests.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Real screens (014–020), real auth or a login endpoint/contract, roles, remember-me, password rules.

## Questions

## Handoff
**Done:** mock sign-in (`session.ts`), `LoginForm`, MSW browser worker, Orbit + Relay shells with routes, nav, placeholders.
**Files changed:** as listed; also both apps' `tsconfig.json` (`vite/client`, `node` types) and `src/test/setup.ts`, services `vitest.setup.ts`.
**Commands run:** lint / typecheck / test / build / format:check → all pass (yes)
**Checked:** 360px ✓ (menu opens, closes on nav) · desktop ✓ · dark ✓ · light: ThemeToggle only (no new colours).
**New dependencies:** apps: `react-router@7.18.4`, `@tanstack/react-query@5.103.2`, `lucide-react@1.47.0`, dev `msw@2.15.0`.
**Maps updated:** COMPONENTS, STRUCTURE, DECISIONS (D23).
**Deviations from task:** test setups restore Node's native `AbortController`/`AbortSignal` (via `util.transferableAbortController()`); jsdom's versions break Node `fetch`/`Request` used by MSW, React Router and TanStack Query. This replaced the NOVA-006 fetch workaround. Placeholder shows "Not built yet" (the page title is already the top-bar `h1`).
**Known gaps:** none.

## Review
**Result:** done (built by Claude while Gemini is offline; clicked through Orbit in the browser)
**Fixed directly (review: commits):** none.
**Rulebook issues found:** none.
**Follow-up tasks created:** none.
