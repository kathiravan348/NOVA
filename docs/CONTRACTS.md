# NOVA — Contracts index

> One line per contract. Update in the same task that adds or changes a contract.
> Source: `frontend/packages/contracts/src/`. Mock: `frontend/packages/mocks/data/`.

| Contract | Endpoint (Stage B) | Mock file | Used by |
|---|---|---|---|
| User | `GET /api/v1/me` | NOVA-005 | Core, Orbit, Relay |
| Strategy | `GET /api/v1/strategies`, `GET /api/v1/strategies/{id}` | NOVA-005 | Orbit |
| BacktestRun | `GET /api/v1/backtests`, `GET /api/v1/backtests/{id}` | NOVA-005 | Orbit |
| BacktestResult | `GET /api/v1/backtests/{id}/result` | NOVA-005 | Orbit |
| Trade | `GET /api/v1/backtests/{id}/trades` | NOVA-005 | Orbit |
| Charges | — | NOVA-005 | Ledger, Orbit, ui-trading |
| BrokerAccount | `GET /api/v1/broker/accounts`, `GET /api/v1/broker/accounts/{id}` | NOVA-005 | Relay |
| RateLimit | `GET /api/v1/broker/rate-limits` | NOVA-005 | Relay |
| DataJob | `GET /api/v1/data-jobs`, `GET /api/v1/data-jobs/{id}` | NOVA-005 | Relay |
| AuditEntry | `GET /api/v1/audit` | NOVA-005 | Relay |
