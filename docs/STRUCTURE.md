# NOVA — Repository map

> Update this file in the same task that adds or moves a folder.

```
/
├─ AGENTS.md            rulebook (all agents)
├─ CLAUDE.md            Claude's role
├─ GEMINI.md            Gemini's role
├─ brand.config.ts      all brand names
├─ docs/
│  ├─ PLAN.md  ARCHITECTURE.md  STRUCTURE.md  CONTRACTS.md  COMPONENTS.md  DECISIONS.md
│  ├─ REVIEW-GUIDE.md   Stage A: how to run (`pnpm review`), walkthrough, feedback checklist
│  ├─ tasks/            BOARD.md + one file per task (NOVA-###.md)
│  └─ templates/        TASK.md, HANDOFF.md, REVIEW.md
├─ frontend/            (created by NOVA-001)
│  ├─ packages/
│  │  ├─ ui-core/       generic components + theme tokens
│  │  │  ├─ scripts/    build-tokens generator
│  │  │  ├─ src/components/ Button, IconButton, Badge, StatusBadge, Card, StatCard, Skeleton, Field, Input, Select, Checkbox, Switch, DateTimePicker
│  │  │  ├─ src/lib/    cn utility, zonedTime UTC/IST conversion
│  │  │  └─ src/theme/  tokens.json, tokens.css, tailwind-theme.css, styles.css
│  │  ├─ ui-trading/    trading components built on ui-core
│  │  ├─ ui-storybook/  Storybook for both libraries
│  │  │  ├─ .storybook/ Storybook config (main, preview)
│  │  │  └─ src/foundations/ Tokens stories
│  │  ├─ contracts/     API types + Zod schemas
│  │  │  └─ schema/     generated JSON Schema per wire contract (D34; do not edit)
│  │  ├─ services/      data layer (mock | real)
│  │  │  ├─ src/api/    one fetch function per endpoint (validated by contract schema)
│  │  │  ├─ src/queries/ TanStack Query keys, hooks, createQueryClient
│  │  │  └─ src/session.ts mock sign-in session (D23)
│  │  └─ mocks/         static JSON per contract + MSW handlers
│  │     ├─ data/       static mock JSON per contract
│  │     ├─ src/handlers/ MSW handlers for contracts and scenarios
│  │     └─ src/browser.ts MSW browser worker (apps' main.tsx, mock mode)
│  └─ apps/             each: public/mockServiceWorker.js, src/routes.tsx, layout/, pages/
│     ├─ nova-orbit/    strategy builder + backtesting (port 3000)
│     └─ nova-relay/    API config + limits (port 3001)
├─ compose.yaml         db (TimescaleDB), redis, core, backend-check (profile tools)
├─ .env.example         every variable with dummy values (copy to .env)
└─ backend/             uv workspace (D33, D36); Dockerfile = one image for all services
   ├─ scripts/check.sh  ruff, format, mypy per package, pytest
   ├─ libs/
   │  ├─ nova_common/   Settings (NOVA_* env), ApiException + error handlers
   │  ├─ nova_contracts/ Pydantic models mirroring @nova/contracts + parity tests (D34)
   │  └─ nova_testing/  shared test helpers: `parity.Parity` (mock JSON + JSON Schema checks)
   └─ services/
      └─ core/          NOVA Core gateway (FastAPI, /api/v1)
```
