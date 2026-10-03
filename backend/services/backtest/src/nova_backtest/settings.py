"""Backtest service settings (`NOVA_*`)."""

from functools import lru_cache
from pathlib import Path

from nova_common import Settings
from pydantic import Field, SecretStr


class BacktestSettings(Settings):
    internal_token: SecretStr
    worker_poll_seconds: float = 2.0
    # D61 (6): price bars one run may load (warm-up included); a run-time guard, since memory stays
    # flat. Measured 27 Sep (NOVA-111): visual 47 M 1m bars ≈ 6.6 min, 0.83 GB peak;
    # Python 5 M 15m bars ≈ 2.7 min, 0.61 GB peak (each stock's sandbox ≈ 0.1 GB).
    backtest_max_bars: int = Field(50_000_000, gt=0)
    backtest_max_bars_python: int = Field(5_000_000, gt=0)
    # D61: pass 1 writes each run's columns and signals here; removed after the run and on start.
    backtest_scratch_dir: Path = Path("/tmp/nova-backtest")  # noqa: S108 - the container's disk
    # D82: recorded runs read archived ticks here (mounted read-only from the Atlas archive volume).
    archive_dir: Path = Path("archive")


@lru_cache(maxsize=1)
def get_backtest_settings() -> BacktestSettings:
    return BacktestSettings()
