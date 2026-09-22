# NOVA-008 — ui-core: form fields (Field, Input, Select, Checkbox, Switch, DateTimePicker IST)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-008 · **Depends on:** NOVA-007

## Goal
`@nova/ui-core` exports accessible form controls that work with React Hook Form (`register` or `Controller`) and show Zod errors, plus a date/time picker that shows IST and stores UTC (D20).

## Read first
- `AGENTS.md` (§6–8), `docs/DECISIONS.md` (D15, D19, D20), `docs/COMPONENTS.md`
- `frontend/packages/ui-core/{package.json,src/index.ts,src/lib/cn.ts}`
- `frontend/packages/ui-core/src/components/Button/*` (pattern to copy: cva, forwardRef, story, test)

## Files
Create in `frontend/packages/ui-core/src/`:
- `components/<Name>/<Name>.tsx`, `.stories.tsx`, `.test.tsx` for: Field, Input, Select, Checkbox, Switch, DateTimePicker
- `components/Field/FormExample.stories.tsx` + `FormExample.test.tsx`
- `lib/zonedTime.ts` + `lib/zonedTime.test.ts`
Modify: `frontend/packages/ui-core/{package.json,src/index.ts}`, `frontend/pnpm-lock.yaml` (via `pnpm install`), `docs/COMPONENTS.md`

## Build
1. Deps (exact latest stable): `@radix-ui/react-checkbox` 1.x, `@radix-ui/react-switch` 1.x, `date-fns` 4.x, `date-fns-tz` 3.x. Move `lucide-react` from devDependencies to dependencies (icons for chevron/check). DevDeps: `react-hook-form` 7.x, `@hookform/resolvers` 5.x (must support Zod 4), `zod` 4.6.5. ui-core source never imports react-hook-form or zod; only the FormExample files do.
2. **Field**: layout for one control. Props `label`, `htmlFor`, `description?`, `error?: string`, `required?`, `children`. Renders `<label>`, the control, description (`text-body-sm text-text-muted`) and error (`text-body-sm text-loss`) with ids `${htmlFor}-description` / `${htmlFor}-error`. Exported for custom controls.
3. Every control takes `label`, `description?`, `error?`, `id?` (default `React.useId()`), wraps itself in Field, sets `aria-invalid` when `error` is set and `aria-describedby` to the ids that exist. Invalid border is `border-loss`. Height `h-10`, `rounded-md`, `border-border-strong`, `bg-bg-surface`, focus ring as Button.
   - **Input**: forwardRef to `<input>`, all input attrs. Adds `leading?`/`trailing?` (ReactNode, inside the box, `text-text-muted`) and `numeric?` (`font-mono text-right`, `inputMode="decimal"`).
   - **Select**: native `<select>` (forwardRef) with `options: { value: string; label: string; disabled?: boolean }[]` and `placeholder?` (a disabled empty first option). Lucide `ChevronDown` icon, `appearance-none`.
   - **Checkbox** / **Switch**: Radix root, props `checked`, `onCheckedChange`, `disabled`. Label sits to the right of the control and is clickable. Checkbox shows Lucide `Check`. Switch thumb moves; checked track `bg-action`.
   - **DateTimePicker**: native input. `mode: "datetime" | "date"`. `datetime`: `value: string | null` is UTC ISO (`2026-09-21T06:30:00Z`), shown in `timeZone` (default `Asia/Kolkata`) with a `timeZoneLabel` suffix (default `IST`); `onChange` returns UTC ISO with seconds and `Z`, or `null` when cleared. `date`: value is `YYYY-MM-DD`, no conversion, no suffix. `min?`/`max?` use the same format as `value`.
4. `lib/zonedTime.ts`: `toZonedInputValue(utcIso, timeZone)` → `"yyyy-MM-ddTHH:mm"` and `fromZonedInputValue(local, timeZone)` → `"yyyy-MM-ddTHH:mm:ssZ"` via `formatInTimeZone`/`fromZonedTime`. Tests: `2026-09-21T06:30:00Z` ↔ `2026-09-21T12:00` (IST), a date crossing midnight, round trip. Results must not depend on the machine time zone.
5. **FormExample** story (`Core/Forms/Example`): Zod schema + `zodResolver` + RHF using all six controls (`register` for Input/Select, `Controller` for the rest). Submitting empty shows the Zod messages under each field. The test renders it via `composeStories` and checks that.
6. Stories per control: Default, WithDescription, Error, Disabled; Input also Numeric and WithAdornments; Select also Placeholder; DateTimePicker also DateMode.
7. Tests: label is linked (`getByLabelText`), `aria-invalid` + error text when `error` set, disabled works, Checkbox/Switch toggle `onCheckedChange`, DateTimePicker converts IST input to UTC in `onChange`.

## Acceptance checks
- [ ] All stories render in dark and light, 0 a11y violations, no horizontal scroll at 360px.
- [ ] Tabbing shows a visible focus ring on every control. Labels click-toggle Checkbox and Switch.
- [ ] `grep -rE "#[0-9a-fA-F]{3,6}" packages/ui-core/src/components` finds nothing.
- [ ] Definition of done in `AGENTS.md` §9.

## Out of scope
- A calendar popover or any date-picker library. Radix Select. Textarea, radio group, combobox.
- IST display formatters for text (planned with the screens). Anything with trading words.
- Changes to tokens, theme files, Button or other existing components.

## Questions

## Handoff

## Review
