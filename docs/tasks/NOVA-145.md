# NOVA-145 — Stored data: Non-index stocks group

**Status:** done · **Owner:** ChatGPT · **Branch:** task/NOVA-145 · **Depends on:** —

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
- [x] Group by **Index** shows **Non-index stocks** (last) with its stock count and missing days.
- [x] Group by **Sector** shows **Unclassified** last; **None** still lists every stock once.
- [x] Definition of done in `AGENTS.md` §9 (`pnpm review:check`).

## Out of scope
- Backend or contract changes, changing how the sector is filled (`UNCLASSIFIED`), the Sync button (NOVA-146).

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** Non-index stocks stay visible; index/sector groups have the required order and download action.
**Files changed:** coverageGroups.tsx, storedData.test.tsx, USER-GUIDE.md, BOARD.md, NOVA-145.md.
**Commands run:** focused Stored data tests (10 passed); pnpm review:check (format, lint, typecheck, tests, build) passed.
**Checked:** 360px ✓ · desktop ✓ · dark ✓ · light ✓ (local Edge screenshots; no horizontal overflow).
**New dependencies:** none.
**Maps updated:** none (no new files, contracts or components).
**Guides updated:** USER-GUIDE (Stored data).
**Deviations from task:** no fixture additions needed; existing GREENGRID-SM/NOVATECH cover both groups. StoredDataPage already delegates grouping.
**Known gaps:** none; independent review pending.

## Review
**Result:** done
**Reviewer / built by:** Claude / ChatGPT. **Self-review:** no.
**Fixed directly (review: commits):** none.
**Change requests:** none.
**Guides checked:** match the diff.
**Rulebook issues found:** none.
**Follow-up tasks:** none.
**Commands run:** stored-data tests (10 passed); full pnpm review:check passed on main after merge.
