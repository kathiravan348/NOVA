"""Market filter (D62 (3)): one condition evaluated on an index's own prices.

The index's bars are read like a stock's (`symbol` = the index name; intraday sizes are rolled up
from its 1m candles). At any time, the filter is the condition's value at the last index bar at or
before that time; before the first index bar it is off.
"""

from dataclasses import dataclass
from datetime import datetime

import numpy as np
import numpy.typing as npt
from nova_contracts.strategy import Regime
from sqlalchemy.orm import Session

from nova_backtest.columns import Columns, Ints
from nova_backtest.columns import load as load_columns
from nova_backtest.engine import EngineError
from nova_backtest.rules import SeriesCache, condition_holds

Bools = npt.NDArray[np.bool_]


@dataclass(frozen=True)
class RegimeSeries:
    ts: Ints  # the index's bar times
    on: Bools  # the condition at each of them

    @classmethod
    def from_columns(cls, regime: Regime, columns: Columns) -> "RegimeSeries":
        return cls(np.array(columns.ts), condition_holds(regime.condition, SeriesCache(columns)))

    def at(self, ts: Ints) -> Bools:
        """For each time: the value at the last index bar at or before it (off before the first)."""
        last = np.searchsorted(self.ts, ts, side="right") - 1
        out = np.zeros(len(ts), dtype=np.bool_)
        known = last >= 0
        out[known] = self.on[last[known]]
        return out


def load_regime(
    db: Session, regime: Regime, timeframe: str, span: tuple[datetime, datetime], start: datetime
) -> RegimeSeries:
    """The index's filter over the run's span (warm-up included); fails without index prices."""
    columns = load_columns(db, "NSE", regime.index, timeframe, *span)
    if len(columns) == 0 or int(columns.ts[-1]) < int(start.timestamp()):
        raise EngineError(
            f"No {regime.index} {timeframe} prices for this period: download them in Relay "
            "(Stored data → Download missing)"
        )
    return RegimeSeries.from_columns(regime, columns)
