# NOVA-004 — Contracts: Orbit (strategy, backtest, trade, charges, user)

**Status:** ready-for-review · **Owner:** Gemini · **Branch:** task/NOVA-004 · **Depends on:** NOVA-001

## Goal
`@nova/contracts` exports Zod schemas and inferred types for users, strategies, backtest runs/results, trades and charges. Relay contracts come in NOVA-023.

## Read first
- `AGENTS.md`, `docs/ARCHITECTURE.md` (Strategies, Data), `docs/DECISIONS.md` (D17)
- `frontend/packages/contracts/{package.json,src/index.ts}`, `docs/CONTRACTS.md`

## Files
Create in `frontend/packages/contracts/`: `vitest.config.ts`, `src/common.ts`, `src/user.ts`, `src/strategy.ts`, `src/backtest.ts`, `src/trade.ts`, `src/charges.ts`, and one `*.test.ts` next to each schema file.
Modify: `package.json` (dep `zod` 4.x; devDep `vitest`; script `"test": "vitest run"`), `src/index.ts` (re-export all; remove `CONTRACTS_NAME`), `docs/CONTRACTS.md`.

## Shapes (each file exports `XSchema` and `type X = z.infer<typeof XSchema>`; objects use `z.strictObject`)
- **common:** `Id` = non-empty string. `UtcDateTime` = `z.iso.datetime()` (Z only). `IsoDate` = `z.iso.date()`. `Paise` = int. `NonNegPaise` = int ≥ 0. `Segment` = `equity_delivery|equity_intraday|futures|options`. `Exchange` = `NSE|NFO`. `Timeframe` = `1m|3m|5m|15m|30m|1h|1d`. `Side` = `buy|sell`.
- **user:** `User` {id, name, email (`z.email()`), role: `super_admin`, createdAt, lastLoginAt: UtcDateTime|null}
- **strategy:**
  - `Operand` = discriminated on `kind`: `price` {field: open|high|low|close|volume} · `indicator` {name: sma|ema|rsi|macd|vwap|atr|bb_upper|bb_lower, params: record<string, number>} · `number` {value}
  - `Condition` {left: Operand, op: crosses_above|crosses_below|gt|gte|lt|lte|eq, right: Operand}
  - `RuleGroup` {combinator: all|any, conditions: Condition[] (min 1)}
  - `Universe` = on `type`: `symbols` {symbols: string[] (min 1)} · `index` {index: "NIFTY 50"|"NIFTY BANK"|"NIFTY NEXT 50"}
  - `Sizing` = on `type`: `fixed_qty` {qty: int > 0} · `fixed_amount` {amountPaise > 0} · `percent_equity` {percent: 0 < p ≤ 100}
  - `Risk` {stopLossPercent: number > 0 | null, targetPercent: number > 0 | null}
  - `StrategySpec` = discriminated on `mode`, with shared base {segment, exchange, timeframe, universe, sizing, risk}: `visual` {entry: RuleGroup, exit: RuleGroup} · `python` {code: non-empty string}
  - `StrategyVersion` {version: int ≥ 1, createdAt, note: string, spec: StrategySpec}
  - `Strategy` {id, name, description, status: draft|active|archived, latestVersion, versions: StrategyVersion[] (min 1), createdAt, updatedAt}. Refine: `latestVersion` equals the max `version`.
- **charges:** `Charges` {brokeragePaise, sttPaise, exchangeTxnPaise, sebiFeePaise, stampDutyPaise, gstPaise, dpPaise, totalPaise} (all NonNegPaise). Refine: total = sum of the others.
- **trade:** `Trade` {id, runId, symbol, exchange, segment, side, qty: int > 0, entryAt, entryPricePaise, exitAt: UtcDateTime|null, exitPricePaise: Paise|null, grossPnlPaise, charges: Charges, netPnlPaise}. Refine: net = gross − charges.totalPaise. exitAt and exitPricePaise are both null or both set.
- **backtest:**
  - `BacktestRun` {id, strategyId, strategyVersion, name, status: queued|running|completed|failed, from: IsoDate, to: IsoDate, initialCapitalPaise > 0, benchmark: "NIFTY 50"|null, createdAt, startedAt|null, finishedAt|null, error: string|null}. Refine: from ≤ to; `error` is set only when status is failed.
  - `BacktestMetrics` {grossPnlPaise, chargesPaise, netPnlPaise, returnPercent, cagrPercent, maxDrawdownPercent (≤ 0), sharpe, winRatePercent (0–100), tradeCount, winCount, lossCount}. Refine: net = gross − charges; win + loss ≤ tradeCount.
  - `EquityPoint` {date: IsoDate, equityPaise, benchmarkPaise: Paise|null}
  - `BacktestResult` {runId, metrics, equityCurve: EquityPoint[]}

## Build
1. Prices are also integer paise (₹1,618.90 = 161890). Never use floats for money.
2. Tests: each schema accepts one valid inline example and rejects each refinement plus one wrong enum. No mock files yet.
3. `CONTRACTS.md`: one row per top-level schema. Endpoints: `GET /api/v1/me`, `GET /api/v1/strategies`, `GET /api/v1/strategies/{id}`, `GET /api/v1/backtests`, `GET /api/v1/backtests/{id}`, `GET /api/v1/backtests/{id}/result`, `GET /api/v1/backtests/{id}/trades`. Leave the Mock column as `NOVA-005`.

## Acceptance checks
- [x] `pnpm --filter @nova/contracts test` passes (root `pnpm test` also covers it once NOVA-002 is merged).
- [x] No `any`, no `z.any()`, no floats named `*Paise`. Every file ≤ 300 lines.
- [x] Definition of done in `AGENTS.md` §9.

## Out of scope
- Broker account, rate limit, data job, audit entry (NOVA-023), mocks, MSW, services, request/mutation shapes, and root `vitest.config.ts` (owned by NOVA-002).

## Questions

## Handoff
**Done:** Implemented all Orbit contracts in `@nova/contracts` with Zod schemas, inferred types, unit tests, and updated CONTRACTS.md.
**Files changed:**
- `frontend/packages/contracts/package.json`
- `frontend/packages/contracts/vitest.config.ts`
- `frontend/packages/contracts/src/index.ts`
- `frontend/packages/contracts/src/common.ts`
- `frontend/packages/contracts/src/common.test.ts`
- `frontend/packages/contracts/src/user.ts`
- `frontend/packages/contracts/src/user.test.ts`
- `frontend/packages/contracts/src/charges.ts`
- `frontend/packages/contracts/src/charges.test.ts`
- `frontend/packages/contracts/src/trade.ts`
- `frontend/packages/contracts/src/trade.test.ts`
- `frontend/packages/contracts/src/strategy.ts`
- `frontend/packages/contracts/src/strategy.test.ts`
- `frontend/packages/contracts/src/backtest.ts`
- `frontend/packages/contracts/src/backtest.test.ts`
- `docs/CONTRACTS.md`
- `docs/tasks/BOARD.md`
- `docs/tasks/NOVA-004.md`
**Commands run:** lint / typecheck / test / build → all pass? yes
**Checked:** 360px N/A · desktop N/A · dark N/A · light N/A (contracts package only)
**New dependencies:** `zod@^4.6.5` (contract schemas), `vitest@3.2.7` (test runner devDep).
**Maps updated:** CONTRACTS.
**Deviations from task:** none.
**Known gaps:** none.

## Review

