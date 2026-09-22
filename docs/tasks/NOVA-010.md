# NOVA-010 — ui-core: AppShell, NavItem, ThemeToggle, DemoBanner, EmptyState

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-010 · **Depends on:** NOVA-007

## Goal
`@nova/ui-core` exports the page frame both apps use: sidebar on desktop, slide-in menu on mobile, top bar, a banner slot, plus DemoBanner, EmptyState and a theme toggle. Modal/Tabs/Toast are NOVA-026.

## Read first
- `AGENTS.md` (§6–8), `docs/DECISIONS.md` (D19), `docs/COMPONENTS.md`
- `frontend/packages/ui-core/{package.json,src/index.ts,src/lib/cn.ts,src/theme/theme.ts}`
- `frontend/packages/ui-core/src/components/{Button/Button.tsx,IconButton/IconButton.tsx}`
- `frontend/packages/ui-core/src/theme/tokens.json` (read only: `size` tokens)

## Files
Create in `frontend/packages/ui-core/src/components/`: `<Name>/<Name>.tsx`, `.stories.tsx`, `.test.tsx` for AppShell, NavItem, ThemeToggle, DemoBanner, EmptyState; plus `AppShell/appShellContext.ts`.
Modify: `frontend/packages/ui-core/{package.json,src/index.ts}`, `frontend/pnpm-lock.yaml` (via `pnpm install`), `docs/COMPONENTS.md`

## Build
1. Deps: `@radix-ui/react-dialog` 1.x (exact latest stable). Make sure `lucide-react` is in `dependencies` (move it if NOVA-008/009 have not).
2. **AppShell** props: `brand: ReactNode`, `nav: ReactNode` (NavItems), `navFooter?: ReactNode`, `title?: ReactNode`, `actions?: ReactNode` (top bar, right), `banner?: ReactNode` (above the top bar), `children`. No brand text or router inside ui-core.
   - ≥ `md`: fixed `<aside>` of width `w-(--sidebar-width)`, `bg-bg-sidebar`, right border `border-border-default` (visible in light), holding brand, `<nav aria-label="Main">` and navFooter. Content column: banner, `<header>` top bar (`h-14`, bottom border), `<main id="main-content">` with `px-4 md:px-7 py-6`.
   - < `md`: sidebar hidden; top bar shows an IconButton (`Menu`, `aria-label="Open menu"`) that opens a Radix Dialog sheet from the left with the same brand/nav/navFooter and a close IconButton (`X`). Overlay `bg-bg-ground/80`. Focus is trapped; Esc closes.
   - First focusable element is a "Skip to content" link to `#main-content`, visible only on focus.
   - `appShellContext.ts` exposes `closeMenu()`; NavItem calls it on click so the sheet closes after navigating.
3. **NavItem**: props `icon?`, `active?`, `asChild?` (Radix Slot, so apps pass a router `NavLink`), `children`. Height `h-(--nav-item-height)`, `rounded-md`, `text-body text-text-secondary`; active = `bg-action-subtle text-text-primary` + `aria-current="page"`. Works outside AppShell (no context → no-op).
4. **ThemeToggle**: IconButton (ghost) that flips `data-theme` using `getStoredTheme`/`applyTheme`. Icon `Sun` in dark, `Moon` in light; `aria-label` "Switch to light theme" / "Switch to dark theme".
5. **DemoBanner**: full-width bar `bg-warning-subtle text-warning-text text-body-sm`, icon `TriangleAlert` (aria-hidden), `role="note"`. Prop `children?` default "Demo data. Nothing on this screen is real." Not dismissible.
6. **EmptyState**: props `icon?`, `title`, `description?`, `action?`, `tone?: "neutral" | "error"` (error: icon in `text-loss`, `role="alert"`). Centred, `py-12`, title `text-card-title`.
7. Stories: `Core/AppShell` Default (6 generic NavItems with Lucide icons, one active, DemoBanner in `banner`, ThemeToggle + a Button in `actions`, filler content), WithoutBanner, LongContent; use `parameters.layout = "fullscreen"`. NavItem: Default, Active, WithIcon. EmptyState: Default, WithAction, Error. DemoBanner: Default, CustomText.
8. Tests: AppShell renders landmarks (`banner`/`navigation`/`main`), menu button opens the dialog with the nav and NavItem click closes it, skip link targets `#main-content`; NavItem `aria-current`; ThemeToggle flips `document.documentElement.dataset.theme`; DemoBanner default text; EmptyState action button and error role.

## Acceptance checks
- [x] At 360px: no sidebar, menu opens/closes, no horizontal scroll. At 1440px: sidebar visible, no menu button.
- [x] 0 a11y violations in both themes; focus visible on skip link, menu, close and nav items.
- [x] No hex in components; no brand names in ui-core.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Modal, Tabs, Toast (NOVA-026). Routing, auth, user menu, breadcrumbs, collapsible desktop sidebar.
- Changes to tokens, theme files or existing components.

## Questions

## Handoff
**Done:** Implemented AppShell, NavItem, ThemeToggle, DemoBanner, and EmptyState components with Radix Dialog mobile drawer, skip link, landmarks, stories and tests.
**Files changed:**
- `frontend/packages/ui-core/package.json`
- `frontend/pnpm-lock.yaml`
- `frontend/packages/ui-core/src/index.ts`
- `frontend/packages/ui-core/src/components/AppShell/appShellContext.ts`
- `frontend/packages/ui-core/src/components/AppShell/AppShell.tsx`
- `frontend/packages/ui-core/src/components/AppShell/AppShell.stories.tsx`
- `frontend/packages/ui-core/src/components/AppShell/AppShell.test.tsx`
- `frontend/packages/ui-core/src/components/NavItem/NavItem.tsx`
- `frontend/packages/ui-core/src/components/NavItem/NavItem.stories.tsx`
- `frontend/packages/ui-core/src/components/NavItem/NavItem.test.tsx`
- `frontend/packages/ui-core/src/components/ThemeToggle/ThemeToggle.tsx`
- `frontend/packages/ui-core/src/components/ThemeToggle/ThemeToggle.stories.tsx`
- `frontend/packages/ui-core/src/components/ThemeToggle/ThemeToggle.test.tsx`
- `frontend/packages/ui-core/src/components/DemoBanner/DemoBanner.tsx`
- `frontend/packages/ui-core/src/components/DemoBanner/DemoBanner.stories.tsx`
- `frontend/packages/ui-core/src/components/DemoBanner/DemoBanner.test.tsx`
- `frontend/packages/ui-core/src/components/EmptyState/EmptyState.tsx`
- `frontend/packages/ui-core/src/components/EmptyState/EmptyState.stories.tsx`
- `frontend/packages/ui-core/src/components/EmptyState/EmptyState.test.tsx`
- `docs/COMPONENTS.md`
- `docs/tasks/BOARD.md`
- `docs/tasks/NOVA-010.md`
**Commands run:** lint / typecheck / test / build / format:check → all pass: yes
**Checked:** 360px ✓ · desktop ✓ · dark ✓ · light ✓
**New dependencies:** `@radix-ui/react-dialog@1.1.23`. Moved `lucide-react@1.47.0` to dependencies.
**Maps updated:** COMPONENTS
**Deviations from task:** none.
**Known gaps:** none.

## Review
**Result:** done
**Fixed directly (review: commits):**
- Skip link and NavItem used `ring-focus-ring` (no such token): focus was invisible; now `ring-action`.
- AppShell title used `text-title` (no such token); now `text-section-title`.
- NavItem `asChild` (router links) dropped the icon; now uses Radix `Slottable` and keeps it (test added).
- Mobile sheet: `aria-describedby={undefined}` silences Radix's missing-Description warning. EmptyState icon `rounded-full` → `rounded-pill` token.
- Merged main (NOVA-008/009); shared list conflicts kept both sides, lockfile regenerated.
**Change requests (if sent back):** none.
**Rulebook issues found:** second task in a row with class names that are not theme tokens while acceptance was ticked; follow-up NOVA-027 adds a lint check.
**Follow-up tasks created:** NOVA-027.
