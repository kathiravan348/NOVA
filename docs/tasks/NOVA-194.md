# NOVA-194 — Orbit: Research plan page (profile editor, notes, freeze) (D84)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-194 · **Depends on:** NOVA-184

## Goal
Orbit gets a **Research plan** menu item where the Owner creates a research profile, edits a draft version's
settings in six sections with a plain-language note under each field, adds a new version, and **Freezes** a
version (then read-only, with its fingerprint). This is the guide's "Intraday Planning Studio" settings part.

## Read first
- `AGENTS.md` §6, §7a; `docs/INTRADAY-RESEARCH.md` §2 (fields, defaults, rules); `docs/tasks/NOVA-182.md` (hooks, errors)
- `frontend/apps/nova-orbit/src/routes.tsx`, `layout/AppLayout.tsx`, `pages/editor/ExitsFields.tsx` (field style)

## Files
Create:
- `frontend/apps/nova-orbit/src/pages/research/ResearchProfilesPage.tsx` (list + **New profile**)
- `ResearchProfilePage.tsx` (versions, Edit / New version / Freeze), `ResearchSettingsForm.tsx`, `SettingsSection.tsx`
- `researchNotes.ts` (label, unit, note and example per field), `researchForm.ts` (form ↔ contract), `research.test.tsx`, `researchForm.test.ts`
Modify:
- `frontend/apps/nova-orbit/src/routes.tsx`, `layout/AppLayout.tsx`, `routes.test.tsx`
- `docs/guides/USER-GUIDE.md` (new section "Research plan"; the "not there yet" list)

## Build
1. Routes `/research` (list) and `/research/:id` (profile). Menu item **Research plan** after **Library**.
2. List: name, latest version, frozen or draft, updated; **New profile** opens a name + description dialog and
   creates version 1 with `DEFAULT_RESEARCH_SETTINGS`.
3. Profile page: versions table (version, note, Draft/Frozen badge, fingerprint first 12 characters, frozen at).
   Selecting a draft shows the form; a frozen one shows the same form read-only. **New version** copies the
   chosen version's settings into a new draft with a note. **Freeze** asks to confirm ("A frozen version can never
   change. Runs and experiments use it as it is.") then calls freeze.
4. Form (React Hook Form + Zod `ResearchSettingsSchema`): sections Account, Execution, Market, Signal, Timing, Data
   in `Card`s (collapsible on mobile); each field shows its unit (₹ amounts computed for ₹10,00,000 next to
   percents, e.g. "0.10 % = ₹1,000"), the note from `researchNotes.ts` (plain words, from the guide chapters 4–8)
   and cross-field errors at the field the contract names. Fixed v1 rules (§2 last line) are listed read-only.
5. Demo mode works on the NOVA-182 mocks; real mode on NOVA-184.

## Acceptance checks
- [ ] Tests: create profile; edit a draft and save; pools over 100 shows "Pools must sum to at most 100 percent"
      at **Reserve**; freeze → read-only + fingerprint; new version from a frozen one; frozen version cannot be saved.
- [ ] Every §2 field has a note in `researchNotes.ts` (test compares keys with the schema).
- [ ] Checked at 360px and desktop, dark and light; `pnpm review:check` passes.

## Out of scope
- Experiments (196), strategies (195), backend (184). Deleting profiles.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
