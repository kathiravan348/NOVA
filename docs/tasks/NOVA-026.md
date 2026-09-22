# NOVA-026 — ui-core: Modal, Tabs, Toast

**Status:** in-review · **Owner:** Claude · **Branch:** task/NOVA-026 · **Depends on:** NOVA-010

## Goal
`@nova/ui-core` exports a Modal dialog, data-driven Tabs and a toast system, all on Radix, each with stories and tests. (Split out of NOVA-010.)

## Read first
- `AGENTS.md` (§6–8), `docs/DECISIONS.md` (D19), `docs/COMPONENTS.md`
- `frontend/packages/ui-core/{package.json,src/index.ts,src/lib/cn.ts}`
- `frontend/packages/ui-core/src/components/{Button/Button.tsx,IconButton/IconButton.tsx,AppShell/AppShell.tsx}` (AppShell only for its Radix Dialog sheet pattern)

## Files
Create in `frontend/packages/ui-core/src/components/`:
- `Modal/Modal.tsx`, `.stories.tsx`, `.test.tsx`
- `Tabs/Tabs.tsx`, `.stories.tsx`, `.test.tsx`
- `Toast/ToastProvider.tsx`, `Toast/toastContext.ts`, `Toast/useToast.ts`, `Toast/Toast.stories.tsx`, `Toast/Toast.test.tsx`
Modify: `frontend/packages/ui-core/{package.json,src/index.ts}`, `frontend/pnpm-lock.yaml` (via `pnpm install`), `docs/COMPONENTS.md`

## Build
1. Deps (exact latest stable): `@radix-ui/react-tabs` 1.x, `@radix-ui/react-toast` 1.x. `@radix-ui/react-dialog` is already there from NOVA-010.
2. **Modal** (Radix Dialog): props `open?`, `onOpenChange?`, `defaultOpen?`, `trigger?: ReactNode` (rendered with `asChild`), `title: ReactNode` (required, `Dialog.Title`, `text-card-title`), `description?` (`Dialog.Description`), `children`, `footer?` (right-aligned actions; stacked full-width below `sm`). Close IconButton (`X`, `aria-label="Close"`). Panel `bg-bg-surface border-border-default rounded-lg`, width `w-[calc(100%-2rem)] max-w-lg`, max height with inner scroll. Overlay `bg-bg-ground/80`.
3. **Tabs** (Radix Tabs): props `items: { value: string; label: ReactNode; content: ReactNode; disabled?: boolean }[]`, `value?`, `defaultValue?` (default first item), `onValueChange?`, `ariaLabel: string`. List has a bottom border; active trigger `text-text-primary` with a 2px `bg-action` underline, others `text-text-muted`. List scrolls sideways (`overflow-x-auto`) instead of widening the page.
4. **Toast** (Radix Toast):
   - `ToastProvider` wraps children with Radix `Provider` + `Viewport`, holds a list of toasts in state and provides it through `toastContext`.
   - `useToast()` returns `{ show(t: { title: string; description?: string; tone?: "neutral" | "success" | "danger"; durationMs?: number }): void }`. Throws a clear error outside the provider.
   - Each toast: `bg-bg-surface border rounded-md`, left accent/icon by tone (success `text-profit` `CircleCheck`, danger `text-loss` `CircleAlert`, neutral `text-action-text` `Info`), close IconButton. Default duration 5000 ms. Danger toasts use Radix `type="foreground"`, others `background`.
   - Viewport: bottom-right on desktop, bottom full-width (with `px-4`) on mobile; max 3 visible.
5. Stories: `Core/Modal` Default (trigger button + footer buttons), LongContent, WithoutDescription. `Core/Tabs` Default (3 tabs), WithDisabled, Many (8 tabs, to show scroll at 360px). `Core/Toast` Playground with a button per tone.
6. Tests: Modal opens from trigger, has dialog role with accessible name, Esc and Close button close it, focus returns to trigger. Tabs: arrow keys move between tabs, clicking shows the matching panel, disabled tab is skipped. Toast: `show()` renders title/description with the tone icon, close removes it, `useToast` outside provider throws.

## Acceptance checks
- [x] All stories render in dark and light, 0 a11y violations, no horizontal page scroll at 360px.
- [x] Focus is trapped in the open Modal and visible on every trigger, tab and close button.
- [x] No hex in components. Definition of done in `AGENTS.md` §9.

## Out of scope
- Confirm-dialog helpers, drawers, toasts with action buttons, promise toasts, any toast library (sonner etc.).
- Changes to AppShell, other existing components, tokens or theme files.

## Questions

## Handoff
**Done:** Implemented Modal, Tabs, and Toast system (ToastProvider + useToast) on Radix UI with responsive layouts, stories, and comprehensive tests.
**Files changed:**
- `frontend/packages/ui-core/package.json`
- `frontend/pnpm-lock.yaml`
- `frontend/packages/ui-core/src/index.ts`
- `frontend/packages/ui-core/src/components/Modal/Modal.tsx`
- `frontend/packages/ui-core/src/components/Modal/Modal.stories.tsx`
- `frontend/packages/ui-core/src/components/Modal/Modal.test.tsx`
- `frontend/packages/ui-core/src/components/Tabs/Tabs.tsx`
- `frontend/packages/ui-core/src/components/Tabs/Tabs.stories.tsx`
- `frontend/packages/ui-core/src/components/Tabs/Tabs.test.tsx`
- `frontend/packages/ui-core/src/components/Toast/toastContext.ts`
- `frontend/packages/ui-core/src/components/Toast/useToast.ts`
- `frontend/packages/ui-core/src/components/Toast/ToastProvider.tsx`
- `frontend/packages/ui-core/src/components/Toast/Toast.stories.tsx`
- `frontend/packages/ui-core/src/components/Toast/Toast.test.tsx`
- `docs/COMPONENTS.md`
- `docs/tasks/BOARD.md`
- `docs/tasks/NOVA-026.md`
**Commands run:** lint / typecheck / test / build / format:check → all pass: yes
**Checked:** 360px ✓ · desktop ✓ · dark ✓ · light ✓
**New dependencies:** `@radix-ui/react-tabs@1.1.21`, `@radix-ui/react-toast@1.2.23`.
**Maps updated:** COMPONENTS
**Deviations from task:** none.
**Known gaps:** none.

## Review
