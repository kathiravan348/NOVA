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
│  │  ├─ services/      data layer (mock | real)
│  │  │  ├─ src/api/    one fetch function per endpoint (validated by contract schema)
│  │  │  └─ src/queries/ TanStack Query keys, hooks, createQueryClient
│  │  └─ mocks/         static JSON per contract + MSW handlers
│  │     ├─ data/       static mock JSON per contract
│  │     └─ src/handlers/ MSW handlers for contracts and scenarios
│  └─ apps/
│     ├─ nova-orbit/    strategy builder + backtesting
│     └─ nova-relay/    API config + limits
└─ backend/             (Stage B)
```
