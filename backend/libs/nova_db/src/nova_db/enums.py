"""Values of text enum columns (CHECK constraints), copied from the Zod enums in contracts."""

SEGMENTS = ("equity_delivery", "equity_intraday", "futures", "options")
EXCHANGES = ("NSE", "NFO")
TIMEFRAMES = ("1m", "3m", "5m", "15m", "30m", "1h", "1d")
SIDES = ("buy", "sell")

STRATEGY_STATUSES = ("draft", "active", "archived")
BACKTEST_STATUSES = ("queued", "running", "completed", "failed")
BENCHMARKS = ("NIFTY 50",)

BROKERS = ("zerodha",)
RATE_LIMIT_ENDPOINTS = ("quote", "historical", "orders", "other")
RATE_LIMIT_WINDOWS = ("second", "minute", "day")

DATA_JOB_TYPES = ("historical_download", "tick_record", "archive", "instrument_sync")
DATA_JOB_STATUSES = ("draft", "queued", "running", "completed", "failed", "cancelled", "paused")
DOWNLOAD_MODES = ("skip_existing", "overwrite")
JOB_STEP_STATUSES = ("pending", "done", "skipped")
MARKET_HOURS_MODES = ("slow", "full")

AUDIT_ACTIONS = (
    "auth.login",
    "auth.logout",
    "broker.login",
    "broker.session_expired",
    "broker.rate_limit_update",
    "broker.account_create",
    "broker.kite_app_update",
    "strategy.create",
    "strategy.update",
    "backtest.run",
    "data_job.create",
    "data_job.cancel",
    "data_job.plan",
    "data_job.start",
    "data_job.pause",
    "data_job.resume",
    "data_job.delete",
    "instrument.add",
    "instrument.update",
    "instrument.remove",
    "instrument.sync",
    "instrument.clear_new",
    "settings.update",
    "download_settings.update",
)
AUDIT_TARGET_TYPES = (
    "user",
    "broker_account",
    "strategy",
    "backtest",
    "data_job",
    "settings",
    "instrument",
)

ROLE_SUPER_ADMIN = "super_admin"


def sql_in(column: str, values: tuple[str, ...]) -> str:
    """SQL for `column IN ('a', 'b')`; values are constants from this module, never user input."""
    quoted = ", ".join("'" + value.replace("'", "''") + "'" for value in values)
    return f"{column} IN ({quoted})"
