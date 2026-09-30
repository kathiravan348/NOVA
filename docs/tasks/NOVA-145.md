# NOVA-145 — Stored data: Non-index stocks group

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-145 · **Depends on:** —

## Goal
Grouped by **Index**, Stored data also shows stocks that belong to no index, under **Non-index stocks**, so every
stock has coverage in view (D74 (6)). **Sector** grouping already lists **Unclassified**; keep it.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` row D74; the files below.

## Files
Modify:
- `frontend/apps/nova-relay/src/pages/stored-data/coverageGroups.tsx`
- `frontend/apps/nova-relay/src/pages/stored-data/StoredDataPage.tsx`
- `frontend/apps/nova-relay/src/pages/stored-data/storedData.test.tsx`
- `frontend/packages/mocks/data/coverage.json` (add one stock in no index and one **Unclassified** sector stock if missing)
- `docs/guides/USER-GUIDE.md` (Stored data section), `docs/tasks/{BOARD.md,NOVA-145.md}`

## Build
1. `coverageGroups`, `by === "index"`: a stock with `indices.length === 0` goes to the key `Non-index stocks`
   (today an empty key list hides the row). Index rows still go under `Indices`.
2. `order`: `Indices` first, then index names alphabetically, `Non-index stocks` last. Sector grouping: `Unclassified`
   last, others alphabetical.
3. Group header summary and **Download missing** work as for any group (reuse `groupSummary`, `needsDownload`).
4. Group-by select keeps `Index` / `Sector` / `None`; no new option.
5. Mock rows and tests: the **Non-index stocks** group lists the stock and its **Download missing** queues it;
   with **Sector**, **Unclassified** appears last.
6. USER-GUIDE: one paragraph on the two new groups.

## Acceptance checks
- [ ] Group by **Index** shows **Non-index stocks** (last) with its stock count and missing days.
- [ ] Group by **Sector** shows **Unclassified** last; **None** still lists every stock once.
- [ ] Definition of done in `AGENTS.md` §9 (`pnpm review:check`).

## Out of scope
- Backend or contract changes, changing how the sector is filled (`UNCLASSIFIED`), the Sync button (NOVA-146).

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — see `docs/templates/REVIEW.md`)_
