"""StrategyStats (D26): mirrors `frontend/packages/contracts/src/strategyStats.ts`."""

from typing import Annotated, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Id, Paise, UtcDateTime

Count = Annotated[int, Field(ge=0)]
Percent = Annotated[float, Field(ge=0, le=100)]


class BestNetPnl(Contract):
    run_id: Id
    net_pnl_paise: Paise


class StrategyStats(Contract):
    strategy_id: Id
    runs_total: Count
    runs_completed: Count
    runs_failed: Count
    runs_in_progress: Count
    last_run_at: UtcDateTime | None
    best_return_percent: float | None
    worst_return_percent: float | None
    win_rate_min_percent: Percent | None
    win_rate_max_percent: Percent | None
    worst_drawdown_percent: Annotated[float, Field(le=0)] | None
    best_net_pnl: BestNetPnl | None

    @model_validator(mode="after")
    def _rules(self) -> Self:
        if self.runs_total != self.runs_completed + self.runs_failed + self.runs_in_progress:
            raise ValueError("runsTotal must equal completed + failed + in progress")
        if (self.runs_total == 0) != (self.last_run_at is None):
            raise ValueError("lastRunAt is set exactly when there is a run")
        results = (
            self.best_return_percent,
            self.worst_return_percent,
            self.win_rate_min_percent,
            self.win_rate_max_percent,
            self.worst_drawdown_percent,
            self.best_net_pnl,
        )
        expected_set = self.runs_completed > 0
        if any((value is not None) != expected_set for value in results):
            raise ValueError("result stats are set exactly when a run completed")
        best, worst = self.best_return_percent, self.worst_return_percent
        if best is not None and worst is not None and worst > best:
            raise ValueError("worstReturnPercent must be at most bestReturnPercent")
        low, high = self.win_rate_min_percent, self.win_rate_max_percent
        if low is not None and high is not None and low > high:
            raise ValueError("winRateMinPercent must be at most winRateMaxPercent")
        return self
