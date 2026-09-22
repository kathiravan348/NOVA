# NOVA — Decisions log

> Newest last. One short entry per decision. Only Claude or the Owner adds entries.

| # | Date | Decision | Why |
|---|---|---|---|
| D1 | 2026-09-22 | Name: NOVA (Networked Order & Value Analytics); products Orbit, Relay, Core, Atlas, Ledger, UI, Style | Owner choice; names in `brand.config.ts` only |
| D2 | 2026-09-22 | Broker: Zerodha Kite Connect (paid plan, one key in Phase 1) | Paid plan includes live + historical data |
| D3 | 2026-09-22 | Phase 1 = strategy building + backtesting only | Prove strategies before any real money |
| D4 | 2026-09-22 | UI first with static mocks (Stage A), backend after scope freeze (Stage B) | Get feedback on a visible workflow first |
| D5 | 2026-09-22 | Frontend: React + TS + Vite monorepo; backend: Python + FastAPI | Best libraries for each side |
| D6 | 2026-09-22 | Light microservices: core, broker, atlas, ledger, strategy, backtest | Enough separation without heavy integration cost |
| D7 | 2026-09-22 | UI library in the same monorepo; `ui-core` generic and publish-ready, `ui-trading` separate | Reuse in future projects |
| D8 | 2026-09-22 | Design system NOVA Style: dark navy default + light theme, IBM Plex Sans/Mono | Approved theme preview |
| D9 | 2026-09-22 | Strategies: visual builder and Python, both produce one Strategy Spec | One engine, one results format |
| D10 | 2026-09-22 | All segments designed from day one; engines built delivery → intraday → futures → options | Avoid redesign without multiplying bugs |
| D11 | 2026-09-22 | Finest data: 1-minute historical from Kite; ticks recorded live from go-live | Kite has no historical second/tick data |
| D12 | 2026-09-22 | Single super-admin in Phase 1; roles tables exist for later | Roles not finalised |
| D13 | 2026-09-22 | Mobile responsive from 360px | Family will use phones |
| D14 | 2026-09-22 | Claude plans and reviews (may fix during review); Gemini implements; task status is the lock | Parallel work without collisions |
| D15 | 2026-09-22 | Tailwind CSS v4 is configured in CSS (`@theme`) generated from `tokens.json`, with the default colours, radii and text sizes removed | Only token classes exist, so no hex values can creep in |
| D16 | 2026-09-22 | IBM Plex fonts are self-hosted via `@fontsource/*` (no font CDN) | Works offline and makes no third-party requests |
| D17 | 2026-09-22 | Contracts: money and prices in integer paise; timestamps as ISO-8601 UTC strings (`Z`); calendar dates as `YYYY-MM-DD`; strict objects | One unambiguous wire format for Stage B |
| D18 | 2026-09-22 | Storybook 10 lives in `ui-storybook`; stories sit next to their component (`X.stories.tsx`) in ui-core/ui-trading and are picked up by glob | Component, story and test stay together; one Storybook for both libraries |
| D19 | 2026-09-22 | ui-core components follow shadcn/ui patterns, written by hand (no CLI): `cva` variants; `cn` = clsx + tailwind-merge extended with the token text sizes; Radix only where behaviour needs it (Slot for `asChild`) | We own the source and nothing is regenerated; tailwind-merge must know the custom `text-*` sizes or it drops classes |
| D20 | 2026-09-23 | Form controls: native `<input>`/`<select>` (dates via `datetime-local`/`date`), Radix only for Checkbox and Switch. Controls take `label`/`error` props and never import react-hook-form or zod; apps wire RHF (`register`/`Controller`) with `@hookform/resolvers/zod`. Date values are UTC, shown in `Asia/Kolkata` via date-fns-tz | Native pickers work best on phones; ui-core stays props-only; no date-picker library |
| D21 | 2026-09-23 | Mock API: MSW handlers in `@nova/mocks` under `/api/v1` (any origin); bare JSON bodies (lists are arrays); errors are `ApiError` `{ error: { code, message } }`; `emptyHandlers`/`errorHandlers` for states | One wire format for mock and real; stories and tests can show empty/error states. Pagination envelope is decided at scope freeze |
| D22 | 2026-09-23 | `@nova/services` validates every response with its contract schema (`safeParse`; mismatch = `invalid_response` error). `VITE_DATA_MODE=mock` (default) fetches same-origin `/api/v1` served by MSW; `real` is refused until Stage B. TanStack Query hooks per endpoint; no retry on 4xx | Mock and real share one code path; bad data fails loudly at the boundary instead of deep in a screen |
| D23 | 2026-09-23 | Apps: `react-router` 7 (v8 needs React 19) with a shared `routes` array per app; mock sign-in accepts any non-empty username/password and keeps `{ userId, displayName }` in `sessionStorage` (no login endpoint or contract until Stage B); MSW browser worker starts from `main.tsx` only in mock mode via `@nova/mocks/browser` | Clickable prototype without inventing an auth API; the same routes serve the browser and memory-router tests |
| D24 | 2026-09-23 | Code editing uses CodeMirror 6 (`@codemirror/*` packages directly, no wrapper) inside ui-core `CodeEditor`, themed only with `var(--…)` tokens | Added to the stack for Python strategies (ARCHITECTURE: two authoring modes); small, accessible, works on phones; token theming keeps dark/light in sync |

## Pending
- Options historical data vendor (needed before options backtests).
- Family roles and permissions.
- Domain and trademark check for NOVA naming.
