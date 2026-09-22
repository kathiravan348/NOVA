# NOVA — Agent Rulebook

> Every agent reads this file first, every session. Keep it short: details live in `docs/`.
> NOVA = Networked Order & Value Analytics. A private trading platform for one family.
> Brand names come from `brand.config.ts` only. Never hardcode "NOVA" in UI text.

## 1. Current phase
**Stage A — Prototype.** Frontend only, static mock data, no backend, no real API calls, no orders.
Goal: a clickable, mobile-responsive prototype of NOVA Orbit and NOVA Relay for review.
Full plan: `docs/PLAN.md`. Do not build anything from a later stage.

## 2. Roles
| Agent | Role | May change code? |
|---|---|---|
| Claude (Claude Code) | Planner, architect, reviewer | Only for tasks in `in-review` it owns |
| Gemini (Antigravity) | Implementer | Only for tasks in `in-progress` or `changes-requested` it owns |
| Owner (human) | Approves plans, merges final decisions | Always |

Only Claude edits `AGENTS.md`, `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` and task files' scope.
Gemini never changes a plan. If a task is unclear or wrong, stop and write the question in the task's `Questions` section.

## 3. Task workflow (status = lock)
Board: `docs/tasks/BOARD.md`. Read it at the start of every session.

`draft` (Claude writing) → `planned` → `in-progress` (Gemini) → `ready-for-review` → `in-review` (Claude) → `done`

From `in-review`, Claude may send a task back: `changes-requested` (Gemini) → `ready-for-review`.

Rules:
1. Change the status on the board **before** starting work, and set yourself as owner.
2. Never edit files of a task you do not own.
3. Two tasks whose `Files` lists overlap may not be `in-progress` and `in-review` at the same time. Exception: `frontend/pnpm-lock.yaml` is generated. On a conflict, rebase and re-run `pnpm install`. Never hand-edit it.
   Shared list files do not count as overlap either: `frontend/packages/*/package.json` (dependency lines), `frontend/packages/*/src/index.ts` (export lines), `docs/COMPONENTS.md`, `docs/CONTRACTS.md`, `docs/STRUCTURE.md`. Only add lines to them; on a conflict, rebase and keep both sides.
4. One branch per task: `task/NOVA-###`. Commit all work (`NOVA-###: …`) on it before setting `ready-for-review`. Claude's review fixes are committed on the same branch with prefix `review:`.
5. Claude priority: review `ready-for-review` tasks first, then plan. Keep 1–2 tasks `planned` ahead so Gemini is never idle.
6. Claude fixes small/medium issues directly. If the fix means rewriting most of the task, write a precise change request and set `changes-requested`.
7. Only Claude merges to `main`, after tests pass.

## 4. Token-saving rules (mandatory)
- Read only: this file, `docs/tasks/BOARD.md`, your task file, and the files the task lists. Nothing else unless the task says so.
- Never scan or list the whole repo. Use the maps: `docs/STRUCTURE.md`, `docs/CONTRACTS.md`, `docs/COMPONENTS.md`.
- One task per session. Start a fresh session for the next task.
- Handoff note ≤ 20 lines (`docs/templates/HANDOFF.md`). Review note ≤ 20 lines (`docs/templates/REVIEW.md`).
- Claude reviews `git diff main...task/NOVA-###`, not whole files.
- Prove work with tests and a build, not by re-reading code.
- Do not restate the task or this rulebook in replies. Report only: done / changed files / open questions.
- Update the maps (`STRUCTURE`, `CONTRACTS`, `COMPONENTS`) in the same task that changes them.

## 5. Tech stack (do not add others without a task saying so)
Frontend: React 18, TypeScript (strict), Vite, pnpm workspaces, Tailwind CSS, shadcn/ui (Radix), TanStack Table, TanStack Query, React Hook Form + Zod, date-fns + date-fns-tz, Recharts, TradingView Lightweight Charts, lucide-react, React Router, MSW, Storybook, Vitest + Testing Library.
Backend (Stage B, not now): Python 3.12, FastAPI, PostgreSQL + TimescaleDB, Redis, Parquet, Docker Compose.
Pin exact versions in every `package.json` (no `^` or `~`).
New dependency = note it in the handoff and in `docs/DECISIONS.md` request section. Never add a library that duplicates one above.

## 6. UI rules
- Apps import UI only from `@nova/ui-core` and `@nova/ui-trading`. No one-off styled components inside apps.
- No component goes into an app until it has a Storybook story (states: default, loading, empty, error, disabled where relevant).
- `ui-core` has no trading words, no API calls, no business logic. Data comes in through props only. It never imports from `ui-trading`, `contracts`, `services` or apps.
- Colours, fonts, spacing, radius come only from theme tokens (`frontend/packages/ui-core/src/theme/tokens.json`, the NOVA Style system). **Never write a hex value in a component.**
- Dark theme is default. Both themes must work (`<html data-theme="dark|light">`).
- Mobile responsive from 360px to desktop. Sidebar becomes a menu on mobile; wide tables become stacked cards; charts resize. Check every story at 360px.
- Accessible: real `<button>`, `<a>`, `<label>`; visible focus; text contrast 4.5:1.
- Every screen showing mock data shows the `DemoBanner`.

## 7. Data and format rules
- All app data goes through `frontend/packages/services` → contracts. Screens never import mock JSON directly.
- Contract types + Zod schemas live in `frontend/packages/contracts`. Mocks in `frontend/packages/mocks` match them exactly (validated by a test).
- Stage A mocks are static values: no calculations. Numbers must be consistent (totals match rows, net = gross − charges).
- Store time in UTC, display in IST (`Asia/Kolkata`). Money in INR with Indian grouping: `₹5,00,000`. Signs explicit: `+₹98,244`, `−₹14,236` (real minus sign).
- Numbers render in the mono font and are right-aligned in tables.

## 8. Code rules
- TypeScript strict, no `any`. Named exports. One component per file. Files ≤ 300 lines.
- Tests: every component has a render test; every contract has a schema test against its mock.
- No secrets, keys or tokens in code, mocks, logs or commits. `.env` files are git-ignored.
- Windows: use pnpm scripts, not shell-specific commands. Line endings LF (`.gitattributes`). Paths via `path.join`, never hardcoded `\` or `/`.

## 9. Definition of done (every task)
- [ ] Acceptance checks in the task file all pass
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check` pass
- [ ] Stories added/updated and checked at 360px and desktop, dark and light
- [ ] Maps updated (`STRUCTURE`, `CONTRACTS`, `COMPONENTS`) if touched
- [ ] Handoff note written in the task file; board status updated

## 10. Never
- Never place, modify or cancel real orders (no order code exists before Stage B, and live trading is Phase 5).
- Never call real Zerodha or other APIs in Stage A.
- Never change another task's files, the design tokens, or the plan without a task for it.
- Never delete tests to make a build pass.
