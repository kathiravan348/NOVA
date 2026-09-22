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
│  │  │  └─ src/theme/  tokens.json, tokens.css, tailwind-theme.css, styles.css
│  │  ├─ ui-trading/    trading components built on ui-core
│  │  ├─ ui-storybook/  Storybook for both libraries
│  │  ├─ contracts/     API types + Zod schemas
│  │  ├─ services/      data layer (mock | real)
│  │  └─ mocks/         static JSON per contract + MSW handlers
│  └─ apps/
│     ├─ nova-orbit/    strategy builder + backtesting
│     └─ nova-relay/    API config + limits
└─ backend/             (Stage B)
```
