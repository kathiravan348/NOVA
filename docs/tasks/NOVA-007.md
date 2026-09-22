# NOVA-007 — ui-core: Button, IconButton, Badge, StatusBadge, Card, StatCard, Skeleton

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-007 · **Depends on:** NOVA-003

## Goal
`@nova/ui-core` exports its first seven components, built the shadcn/ui way (D19), each with a story and a render test. ui-core tests run in jsdom with jest-dom matchers.

## Read first
- `AGENTS.md` (§6, §8), `docs/DECISIONS.md` (D15, D18, D19), `docs/COMPONENTS.md`
- `frontend/packages/ui-core/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`
- `frontend/packages/ui-core/src/theme/tailwind-theme.css` (read only: the only colour, text, radius classes that exist)

## Files
Create in `frontend/packages/ui-core/`:
- `vitest.setup.ts`: `import "@testing-library/jest-dom/vitest";`
- `src/lib/cn.ts` (+ `cn.test.ts`): `cn(...inputs)` = `twMerge(clsx(inputs))`, where twMerge comes from `extendTailwindMerge({ extend: { theme: { text: [<every text-* size name in tailwind-theme.css>] } } })`. Without this, `text-body` and `text-text-primary` wrongly cancel each other. The test proves that both are kept, and that `px-2 px-4` resolves to `px-4`.
- `src/components/<Name>/<Name>.tsx`, `<Name>.stories.tsx` and `<Name>.test.tsx` for each component below.
  - **Button**: `cva` variants `variant` = `primary|secondary|ghost|danger` and `size` = `sm|md|lg`. Adds `loading` (shows a spinner made of CSS borders, sets `aria-busy` and disables the button) and `asChild` (Radix `Slot`). Uses `forwardRef` and has a visible focus ring.
  - **IconButton**: square Button with `aria-label: string` required in its props type. Takes `icon: ReactNode`. Reuses Button's variants.
  - **Badge**: `tone` = `neutral|info|success|warning|danger`. Uses the `*-subtle` background with `*-text` text: info = action, success = profit, danger = loss. Text is `text-label`.
  - **StatusBadge**: a Badge with a leading dot (`aria-hidden`) and a `label` prop.
  - **Card**: props `title?`, `actions?`, `footer?`, `children`. Uses `bg-bg-raised`, `border-border-default` and `rounded-lg`. `title` renders as a heading.
  - **StatCard**: builds on Card. Props: `label`, `value: ReactNode` (rendered in `font-mono text-number-lg`), `caption?`, `captionTone?` = `neutral|positive|negative`, and `loading` (shows Skeletons).
  - **Skeleton**: an `animate-pulse` block with `aria-hidden`. Size comes from `className`.
- Stories: title `Core/<Name>`. Include `Default` plus every variant, size or tone as its own story or in one grid story, and `Loading`/`Disabled`/`Empty` wherever the component has that state.

Modify:
- `frontend/packages/ui-core/package.json`: add exact latest stable versions of deps `class-variance-authority` (0.7.x), `clsx` (2.x), `tailwind-merge` (3.x), and `@radix-ui/react-slot` (1.x). Add devDeps `@storybook/react-vite` (same version as ui-storybook) and `lucide-react` (used only in stories).
- `frontend/packages/ui-core/vitest.config.ts`: `environment: "jsdom"`, `setupFiles: ["./vitest.setup.ts"]`
- `frontend/packages/ui-core/tsconfig.json`: add `vitest.setup.ts` to `include`
- `frontend/packages/ui-core/src/index.ts`: named re-exports of the 7 components, their prop types, and `cn`
- `frontend/.prettierignore`: add `packages/ui-core/src/theme/tokens.css` (from the NOVA-003 review). Add `tailwind-theme.css` too if `format:check` flags it.
- `frontend/pnpm-lock.yaml` (via `pnpm install` only), `docs/COMPONENTS.md` (7 rows), `docs/STRUCTURE.md` (`src/components/`, `src/lib/`)

## Build
1. Write the components by hand in shadcn style. Do not run the shadcn CLI and do not add `components.json`.
2. Use only token classes. Spacing uses numeric utilities (`p-4` = 4 × `space-1`). Never use `p-space-4` (it produces no CSS; see the NOVA-003 review).
3. Tests use Testing Library: each component renders, Button `onClick` fires and does not fire when disabled or loading, IconButton has an accessible name, StatCard shows the Skeleton when `loading`.

## Acceptance checks
- [x] Every story renders in `pnpm storybook` in dark and light, with no horizontal scroll at 360px.
- [x] The a11y panel shows 0 violations on every story in both themes. Focus ring is visible on Button and IconButton when tabbing.
- [x] `pnpm format:check` passes. `grep -rE "#[0-9a-fA-F]{3,6}" packages/ui-core/src/components` finds nothing.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Form fields (NOVA-008), tables (NOVA-009), AppShell/Modal/Tabs/Toast/EmptyState/DemoBanner (NOVA-010), anything with trading words or INR formatting (NOVA-011).
- Changes to `tokens.json`, `styles.css`, the generated theme files, or ui-storybook config.
- Any other Radix package or dependency not listed above.

## Questions

## Handoff
**Done:** Implemented 7 ui-core components (Button, IconButton, Badge, StatusBadge, Card, StatCard, Skeleton) with cva variants, stories, and tests.
**Files changed:**
- `frontend/packages/ui-core/src/components/{Button,IconButton,Badge,StatusBadge,Card,StatCard,Skeleton}/*`
- `frontend/packages/ui-core/src/lib/{cn.ts,cn.test.ts}`, `vitest.setup.ts`, `vitest.config.ts`, `tsconfig.json`, `package.json`, `src/index.ts`
- `frontend/.prettierignore`, `frontend/pnpm-lock.yaml`, `docs/COMPONENTS.md`, `docs/STRUCTURE.md`, `docs/tasks/{BOARD.md,NOVA-007.md}`
**Commands run:** lint / typecheck / test / build / format:check → all pass: yes
**Checked:** 360px ✓ · desktop ✓ · dark ✓ · light ✓
**New dependencies:** class-variance-authority@0.7.1, clsx@2.1.1, tailwind-merge@3.7.0, @radix-ui/react-slot@1.3.3, @storybook/react-vite@10.6.0 (dev), lucide-react@1.47.0 (dev).
**Maps updated:** STRUCTURE, COMPONENTS.
**Deviations from task:** none.
**Known gaps:** none.

## Review
**Result:** done
**Fixed directly (review: commits):**
- `StatCard.stories.tsx`, `StatCard.test.tsx`: replaced trading examples (Net P&L, ₹, Max Drawdown, Trades) with generic ones (§6: ui-core has no trading words).
**Change requests:** none.
**Rulebook issues found:** `Button.tsx` primary uses `text-[white]`, an arbitrary colour outside the tokens (D15 intent). Contrast passes in both themes, but there is no `on-action` token. Accepted for now; tracked in NOVA-024.
**Follow-up tasks created:** NOVA-024 (add `on-action` text token; swap `text-[white]` in Button).
**Checked:** lint, typecheck, test (32 passing), build, format:check pass; no hex in components.
