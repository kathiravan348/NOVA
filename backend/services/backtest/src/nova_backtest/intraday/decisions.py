"""The decision log of an intraday run (D84 §5.4): one `intraday_decisions` row per candidate or
add, written at the end of each session so memory holds one day at most. Rows of filled decisions
learn their trade id when the run's trades are saved."""

from nova_db import new_id
from nova_db.models import IntradayDecision
from sqlalchemy import insert, update
from sqlalchemy.orm import Session

from nova_backtest.intraday.position import Position
from nova_backtest.intraday.replay import Decision
from nova_backtest.intraday.tick_data import at_ms


class DecisionLog:
    def __init__(self, db: Session, run_id: str) -> None:
        self.db, self.run_id = db, run_id
        self.rows = 0
        self._filled: list[tuple[str, Position]] = []

    def write(self, decisions: list[Decision]) -> None:
        """Inserts one session's decisions (no trade ids yet) in the run's transaction."""
        if not decisions:
            return
        rows = []
        for d in decisions:
            row_id = new_id("dec")
            rows.append(
                {
                    "id": row_id,
                    "run_id": self.run_id,
                    "at": at_ms(d.at_ms),
                    "symbol": d.symbol,
                    "setup": d.setup,
                    "action": d.action,
                    "outcome": d.outcome,
                    "first_reason": d.first_reason,
                    "reasons": d.reasons,
                    "requested_qty": d.requested_qty,
                    "filled_qty": d.filled_qty,
                }
            )
            if d.position is not None:
                self._filled.append((row_id, d.position))
        self.db.execute(insert(IntradayDecision), rows)
        self.rows += len(rows)

    def link(self, trade_ids: dict[int, str]) -> None:
        """Sets `trade_id` on filled decisions; `trade_ids` maps `id(position)` to its trade."""
        pairs = [
            {"row": row_id, "trade": trade_ids[id(position)]}
            for row_id, position in self._filled
            if id(position) in trade_ids
        ]
        for pair in pairs:
            self.db.execute(
                update(IntradayDecision)
                .where(IntradayDecision.id == pair["row"])
                .values(trade_id=pair["trade"])
            )
