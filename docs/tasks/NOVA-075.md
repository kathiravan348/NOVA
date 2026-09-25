# NOVA-075 — Relay: Instruments page (stock list + Sync with Kite)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-075 · **Depends on:** NOVA-073, NOVA-074

## Goal
A Relay **Instruments** page lists the stock list, lets the super-admin add, edit and remove stocks, and runs
**Sync with Kite**, so no file edit, image rebuild or Docker command is needed (D54).

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` D54, `docs/tasks/NOVA-074.md` (endpoints and contracts)
- `frontend/apps/nova-relay/src/pages/accounts/{AccountsPage,AddAccountModal}.tsx` (table + modal pattern)
- `frontend/apps/nova-relay/src/layout/AppLayout.tsx`, `src/routes.tsx`

## Files
Create:
- `frontend/apps/nova-relay/src/pages/instruments/{InstrumentsPage,UniverseEntryModal,instruments.test}.tsx`
Modify:
- `frontend/packages/services/src/api/marketData.ts`, `src/queries/{marketData,keys}.ts`, `src/queries/queries.test.tsx`
- `frontend/packages/mocks/src/handlers/marketData.ts`
- `frontend/apps/nova-relay/src/layout/AppLayout.tsx`, `src/routes.tsx`, `src/routes.test.tsx`
- `docs/guides/USER-GUIDE.md`

## Build
1. Services: `createUniverseEntry`, `updateUniverseEntry`, `deleteUniverseEntry`, `syncInstruments`; hooks
   refresh the universe list (sync also refreshes market-data instruments).
2. MSW: validates bodies, 400 on duplicate symbol, 201/200/204 without storing; sync answers
   `{synced: all mock symbols, missing: []}`.
3. Nav item **Instruments** (lucide `ListOrdered`) between **Rate limits** and **Data jobs**; route `/instruments`.
4. `InstrumentsPage`: DataTable (search) with **Symbol**, **Name**, **Sector**, **Indices**, **Kite** (badge
   **Synced** / **Not synced**), row actions **Edit** and **Remove**. Toolbar: **Add stock**, **Sync with Kite**.
5. `UniverseEntryModal` (add and edit): **Symbol** (read-only when editing; upper-cased), **Name**, **Sector**,
   **Indices** (checkboxes from the index list). Errors from the contract; server errors in an alert.
6. **Remove** asks "Remove SYMBOL from the list? Its downloaded prices stay." → toast **Stock removed**.
7. **Sync with Kite** shows a spinner, then a toast "Synced 23 stocks" and, when some are missing, an alert
   listing them ("Not found on NSE: XYZ — check the symbol"). A 400 (e.g. not logged in to Kite) shows its message.
8. User guide: new Relay step **Instruments** (what the list is for, add → sync → download), update
   "not there yet" and the "what do I do if" table (a new stock shows **Not synced**: run Sync).

## Acceptance checks
- [ ] Vitest: add with a bad symbol blocks submit; duplicate shows the server message; edit keeps the symbol
      read-only; remove asks first; sync shows the toast and the missing list.
- [ ] Page and modal work at 360px in dark and light; `routes.test` covers `/instruments`.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- Bulk CSV import; exchanges other than NSE; F&O contracts; changing Orbit screens.

## Questions

## Handoff

## Review
