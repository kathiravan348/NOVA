# NOVA — Architecture

## Shape
Many frontends, one shared backend, one shared UI library.

```
apps/nova-orbit ─┐                       ┌─ services/core    (gateway, auth, users/roles)
apps/nova-relay ─┼─ packages/services ───┼─ services/broker  (Kite login, tokens, rate limiter, tick recorder)
                 │   (mock | real)       ├─ services/atlas   (historical download, tick archive)
packages/ui-core │                       ├─ services/ledger  (charges engine; tax later)
packages/ui-trading                      ├─ services/strategy(strategy specs, versions, approval)
packages/contracts (types + Zod) ────────┘─ services/backtest(backtest jobs, results)
```

- **Frontends** only talk to NOVA Core (the gateway). Security is enforced in the backend, never only in the UI.
- **Realtime** (D57): one WebSocket per screen to NOVA Core (`/api/v1/ws`, session cookie). Source today: a Postgres trigger on `data_jobs` → `NOTIFY nova_events` → Core `LISTEN` → every socket. Live prices and orders later add Redis pub/sub into the same socket. Screens keep polling as the fallback.
- **packages/services** is the only place that fetches data. `DATA_MODE=mock` reads MSW-served mocks; `DATA_MODE=real` calls NOVA Core. Screens never change when switching.
- **packages/contracts** defines every request/response shape (TypeScript + Zod) and emits JSON Schema. Backend Pydantic models (`backend/libs/nova_contracts`) mirror them and are tested against the same mocks and schema (D34).

## Strategies
Two authoring modes, one format:
- Visual rule builder → saves a **Strategy Spec** (JSON: universe, timeframe, segment, entry rules, exit rules, sizing, stop-loss/target).
- Python mode → `class Strategy` with `on_bar(self, ctx)` returning `"enter"`, `"exit"` or `None`, run in a restricted
  sandbox (AST check + child process with no environment and resource limits, D47); its metadata is still a Strategy
  Spec with `mode: "python"`.
The backtest engine accepts only Strategy Specs. Results always include charges from NOVA Ledger.

## Data (Stage B)
- PostgreSQL (`backend/libs/nova_db`, D37): users, roles, strategies + versions, backtest runs/results/trades (charges per trade),
  broker accounts/sessions/profiles, rate-limit rules, data jobs, audit log, instruments; `charge_rates` (dated, D42).
- TimescaleDB: candles (1m and up) and `ticks` (recent window), both hypertables. Ticks come only from the live
  recorder (`nova_broker record-ticks`, Compose profile `market`, D49).
- Parquet files: old ticks via `nova_atlas archive-ticks` → `archive/date=YYYY-MM-DD/symbol=SYM/ticks.parquet`
  (volume `tick-archive`, D49); old candles later.
- Redis: rate limiter, job queue.
- Money as integer paise or `Decimal`, never float. Times in UTC.

## Fees and taxes
NOVA Ledger (`backend/libs/nova_ledger`, a library, D42) computes brokerage, STT/CTT, exchange transaction, SEBI fee, stamp duty, GST, DP charges per trade, using rate tables with effective dates (never hardcoded). Every buy lot is stored (date, price, qty, charges) so tax (STCG/LTCG, intraday as speculative) can be computed later.

## Runtime
Development: Windows + Docker Desktop (WSL2), pnpm. Later: VPS in India with static IP (required for live trading).
