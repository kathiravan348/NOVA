"""All tables of schema v1 (D37). Import from here so `Base.metadata` is complete."""

from nova_db.models.auth import AuthSession, Role, User, UserRole
from nova_db.models.backtest import BacktestResult, BacktestRun, Trade
from nova_db.models.base import Base
from nova_db.models.broker import (
    BrokerAccount,
    BrokerKiteApp,
    BrokerProfile,
    BrokerSession,
    RateLimitRule,
    RecorderSetting,
)
from nova_db.models.data import (
    AuditEntry,
    Candle,
    ChargeRate,
    DataJob,
    DataJobStep,
    DownloadSetting,
    Instrument,
    MarketIndex,
    Tick,
    UniverseEntry,
)
from nova_db.models.strategy import Strategy, StrategyVersion

__all__ = [
    "AuditEntry",
    "AuthSession",
    "BacktestResult",
    "BacktestRun",
    "Base",
    "BrokerAccount",
    "BrokerKiteApp",
    "BrokerProfile",
    "BrokerSession",
    "Candle",
    "ChargeRate",
    "DataJob",
    "DataJobStep",
    "DownloadSetting",
    "Instrument",
    "MarketIndex",
    "RateLimitRule",
    "RecorderSetting",
    "Role",
    "Strategy",
    "StrategyVersion",
    "Tick",
    "Trade",
    "UniverseEntry",
    "User",
    "UserRole",
]
