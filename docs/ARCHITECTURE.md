# NOVA — Architecture

## Shape
Many frontends, one shared backend, one shared UI library.

```
apps/nova-orbit ─┐                       ┌─ services/core    (gateway, auth, users/roles)
apps/nova-relay ─┼─ packages/services ───┼─ services/broker  (Kite login, tokens, rate limiter, usage)
                 │   (mock | real)       ├─ services/atlas   (historical download, tick recorder, archive)
packages/ui-core │                       ├─ services/ledger  (charges engine; tax later)
packages/ui-trading                      ├─ services/strategy(strategy specs, versions, approval)
packages/contracts (types + Zod) ────────┘─ services/backtest(backtest jobs, results)
```

- **Frontends** only talk to NOVA Core (the gateway). Security is enforced in the backend, never only in the UI.
- **packages/services** is the only place that fetches data. `DATA_MODE=mock` reads MSW-served mocks; `DATA_MODE=real` calls NOVA Core. Screens never change when switching.
- **packages/contracts** defines every request/response shape (TypeScript + Zod) and emits JSON Schema. Backend Pydantic models (`backend/libs/nova_contracts`) mirror them and are tested against the same mocks and schema (D34).

## Strategies
Two authoring modes, one format:
- Visual rule builder → saves a **Strategy Spec** (JSON: universe, timeframe, segment, entry rules, exit rules, sizing, stop-loss/target).
- Python mode → a class implementing `on_bar(ctx) -> list[Signal]`, run in a restricted sandbox; its metadata is still a Strategy Spec with `mode: "python"`.
The backtest engine accepts only Strategy Specs. Results always include charges from NOVA Ledger.

## Data (Stage B)
- PostgreSQL: users, roles, strategies, backtest runs, trades, charges, audit log, fee-rate tables (with effective dates).
- TimescaleDB: candles (1m and up) and recorded ticks (recent window).
- Parquet files: archive of ticks and old candles, partitioned by date/segment/symbol.
- Redis: rate limiter, job queue.
- Money as integer paise or `Decimal`, never float. Times in UTC.

## Fees and taxes
NOVA Ledger computes brokerage, STT/CTT, exchange transaction, SEBI fee, stamp duty, GST, DP charges per trade, using rate tables with effective dates (never hardcoded). Every buy lot is stored (date, price, qty, charges) so tax (STCG/LTCG, intraday as speculative) can be computed later.

## Runtime
Development: Windows + Docker Desktop (WSL2), pnpm. Later: VPS in India with static IP (required for live trading).
