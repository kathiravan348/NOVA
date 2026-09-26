# NOVA-086 — Broker: NSE index constituents + session status over `/internal`

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-086 · **Depends on:** NOVA-083

## Goal
Atlas can ask the broker service for an index's member list (from NSE's public constituent CSV) and whether
a Kite session is active, so sync (087) can run without calling outside APIs itself (D35, D56 (3), (4)).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D35, D41, D56
- `backend/services/broker/src/nova_broker/{internal,sessions,settings,kite}.py`
- `backend/services/broker/tests/{conftest,test_internal}.py`

## Files
Create:
- `backend/services/broker/src/nova_broker/nse.py`
- `backend/services/broker/tests/test_nse.py`
Modify:
- `backend/services/broker/src/nova_broker/{internal,settings}.py`, `tests/test_internal.py`
- `docs/guides/API.md`

## Build
1. `nse.py`: `fetch_constituents(file: str) -> list[Constituent]` (`symbol`, `company`, `industry`).
   GET `https://www.niftyindices.com/IndexConstituent/{file}` (base URL in settings,
   `NOVA_NSE_INDEX_BASE_URL`, default as given) with a browser-like `User-Agent`, 15 s timeout.
   CSV columns: `Company Name, Industry, Symbol, Series, ISIN Code`; keep rows with Series `EQ`.
   `file` must match `^ind_[a-z0-9_]+\.csv$` (no path injection). Raise `NseError` with a short message on
   HTTP error, timeout, missing columns or zero rows.
2. `GET /internal/nse/constituents?file=ind_nifty50list.csv` (internal token, like the other
   `/internal` routes) → 200 `[{symbol, company, industry}]`; `NseError` → 502 (code `internal`, message says what failed).
   No Kite limiter slot (not a Kite call).
3. `GET /internal/kite/session` → 200 `{loggedIn: bool, accountId: str|null}` from the active session check
   used by `/internal/historical` (no Kite call, no limiter slot).
4. Tests use a fake HTTP transport (never the real NSE site): good file, non-EQ rows skipped, 403, timeout,
   bad file name → 400, missing internal token → 401.

## Acceptance checks
- [ ] pytest for both endpoints, all cases above.
- [ ] `API.md` lists both endpoints with errors.
- [ ] Manual (Owner, once): `docker compose exec broker-kite` curl of the constituents endpoint for NIFTY 50 returns 50 rows.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Caching files. Atlas client code and sync (087). Any NSE page other than constituent CSVs.

## Questions

## Handoff
Built by Claude at the Owner's request. All acceptance checks pass.
- `nse.py`: `fetch_constituents` + router `/internal/nse/constituents`; NSE errors are 502 with code
  `internal` (the error-code list is fixed; the message says what failed). `create_app(nse_transport=…)` for tests.
- `GET /internal/kite/session` lives in `internal.py` next to the other Kite routes.
- Settings: `NOVA_NSE_INDEX_BASE_URL` (default niftyindices.com).
- Checks: broker ruff/mypy/pytest green (134). Guides: API.
- Real check (26 Sep 2026, via the broker container): all 19 seeded files return members
  (NIFTY 500 → 500, NIFTY IT → 10, …); session → logged in.

## Review
Self-reviewed. Stack rebuilt; migration 0009 applied on the real database.
