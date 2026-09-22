# NOVA-027 — Lint: fail on Tailwind classes that have no theme token

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-027 · **Depends on:** NOVA-010

## Goal
`pnpm lint` fails when a ui-core or ui-trading component uses a colour, text-size or radius utility that the theme does not define (e.g. `ring-focus-ring`, `text-title`), which silently renders nothing (NOVA-009/010 reviews).

## Read first
- `AGENTS.md` (§6, §8)
- `frontend/packages/ui-core/package.json` (`lint` script), `frontend/packages/ui-core/scripts/build-tokens.ts` (script style: Node ESM `.ts`, `node:path`, `fileURLToPath`)
- `frontend/packages/ui-core/src/theme/tailwind-theme.css` (it resets `--color-*`, `--text-*`, `--radius-*`, `--font-*` to `initial`, so only listed names exist)

## Files
Create:
- `frontend/packages/ui-core/scripts/check-classes.ts`
- `frontend/packages/ui-core/scripts/check-classes.test.ts`
Modify:
- `frontend/packages/ui-core/package.json` (`lint` script line only)
- `frontend/packages/ui-trading/package.json` (`lint` script line only, if it has component files)

## Build
1. `check-classes.ts` exports `findUnknownClasses(source: string, theme: { colors: Set<string>; texts: Set<string>; radii: Set<string> }): string[]` and a CLI that reads `tailwind-theme.css`, scans `src/components/**/*.tsx` (skip `.test.tsx`, `.stories.tsx`) of the package dir passed as argv, prints `file: class` per hit and exits 1 if any.
2. Theme sets: `--color-<name>:`, `--text-<name>:` (skip names containing `--`), `--radius-<name>:`.
3. Check each class token (strip variants before the last `:` and any `/opacity`):
   - `bg|text|border|ring|ring-offset|divide|outline|fill|stroke|placeholder` + `-<name>` → `<name>` must be a colour, or (for `text-`) a text size or alignment/wrap word; allow `current`, `transparent`, `inherit`, widths (`border`, `border-2`, `ring-2`), sides (`border-t`, `border-t-<colour>`), `outline-none`, `outline-hidden`.
   - `rounded[-side]-<name>` → `<name>` must be a radius, or `none`/`full`.
   - Ignore arbitrary values (`[...]`, `(...)`); they are covered by the hex grep.
4. Tests: known-good strings pass (`focus-visible:ring-offset-bg-ground`, `border-t-transparent`, `text-body-sm`, `text-right`, `hover:bg-bg-raised/50`); `ring-focus-ring`, `text-title`, `rounded-xl`, `bg-blue-500` are reported.
5. Append `&& node scripts/check-classes.ts .` to the `lint` script(s). Current components must pass without edits; if one fails, fix only that class and note it in the handoff.

## Acceptance checks
- [ ] `pnpm lint` passes on main's components; adding `ring-focus-ring` to any component makes it fail with the file and class.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- An ESLint plugin, a Tailwind plugin, spacing/size utilities, apps' code, any token or component change beyond step 5.

## Questions

## Handoff
**Done:** `check-classes.ts` (theme-aware class checker + CLI) wired into ui-core and ui-trading `lint`.
**Files changed:** as listed.
**Commands run:** lint / typecheck / test / build / format:check → all pass (yes)
**Checked:** n/a (no UI). Injecting `ring-focus-ring` into Skeleton fails lint with `src\components\Skeleton\Skeleton.tsx: ring-focus-ring`.
**New dependencies:** none.
**Maps updated:** none.
**Deviations from task:** the scanner reads every string literal (so `cva`/`cn` strings are checked too), not just `className`; bare words like "text" are ignored.
**Known gaps:** apps are not scanned (out of scope); add when apps get components.

## Review
**Result:** done (built by Claude while Gemini is offline)
**Fixed directly (review: commits):** none.
**Rulebook issues found:** none. All current components already pass.
**Follow-up tasks created:** none.
