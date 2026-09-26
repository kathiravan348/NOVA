"""DataJob: mirrors `frontend/packages/contracts/src/dataJob.ts`."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Exchange, Id, IsoDate, Segment, Timeframe, UtcDateTime

DataJobType = Literal["historical_download", "tick_record", "archive", "instrument_sync"]
# `draft`: planned, not started (expires after 24 h); `paused`: stopped between steps (D57).
DataJobStatus = Literal["draft", "queued", "running", "completed", "failed", "cancelled", "paused"]
DownloadMode = Literal["skip_existing", "overwrite"]
MarketHoursMode = Literal["slow", "full"]
Count = Annotated[int, Field(ge=0)]


class DataJobPlanSymbol(Contract):
    """One stock of a plan; `existing_*`: candles already stored in the period."""

    symbol: Annotated[str, Field(min_length=1)]
    steps: Count
    skipped_steps: Count
    existing_from: IsoDate | None
    existing_to: IsoDate | None


class DataJobPlan(Contract):
    """The cost of a download, shown before Start (D57 (2)). `steps` includes skipped ones."""

    steps: Count
    skipped_steps: Count
    requests: Count
    estimated_rows: Count
    estimated_bytes: Count
    estimated_seconds: Count
    estimated_start_at: UtcDateTime
    jobs_ahead: Count
    per_symbol: list[DataJobPlanSymbol]
    warnings: list[Annotated[str, Field(min_length=1)]]


class DataJob(Contract):
    id: Id
    type: DataJobType
    status: DataJobStatus
    exchange: Exchange
    segment: Segment
    # Empty only for `instrument_sync` (D56).
    symbols: list[Annotated[str, Field(min_length=1)]]
    timeframe: Timeframe | None
    # `from` is a Python keyword: the field is `from_`, the wire name stays `from`.
    from_: IsoDate | None = Field(alias="from")
    to: IsoDate | None = Field(alias="to")
    progress_percent: Annotated[float, Field(ge=0, le=100)]
    rows_written: Annotated[int, Field(ge=0)]
    created_at: UtcDateTime
    started_at: UtcDateTime | None
    finished_at: UtcDateTime | None
    error: str | None
    summary: Annotated[str, Field(max_length=500)] | None
    # Planned downloads (D57); null / 0 for other jobs and downloads queued before plans.
    mode: DownloadMode | None
    plan: DataJobPlan | None
    steps_done: Count
    steps_total: Count
    expires_at: UtcDateTime | None

    @model_validator(mode="after")
    def _rules(self) -> Self:
        if self.type == "historical_download" and (
            self.timeframe is None or self.from_ is None or self.to is None
        ):
            raise ValueError("historical_download requires timeframe, from and to")
        if self.type == "tick_record" and self.timeframe is not None:
            raise ValueError("tick_record requires timeframe to be null")
        if not self.symbols and self.type != "instrument_sync":
            raise ValueError("symbols may be empty only for instrument_sync")
        if (self.from_ is None) != (self.to is None) or (
            self.from_ is not None and self.to is not None and self.from_ > self.to
        ):
            raise ValueError("from and to must both be null or both set with from <= to")
        if self.error is not None and self.status != "failed":
            raise ValueError("error is set only when status is failed")
        if self.status == "completed" and (
            self.progress_percent != 100 or self.finished_at is None
        ):
            raise ValueError("completed jobs need progressPercent 100 and finishedAt")
        if self.status == "queued" and (
            self.started_at is not None or self.finished_at is not None
        ):
            raise ValueError("queued jobs have no startedAt or finishedAt")
        if self.status == "draft" and (
            self.started_at is not None
            or self.finished_at is not None
            or self.plan is None
            or self.expires_at is None
        ):
            raise ValueError("drafts need a plan and expiresAt, and are not started")
        return self


MAX_DOWNLOAD_SYMBOLS = 200


class DataJobCreate(Contract):
    """Body of `POST /data-jobs`: queue a historical download (D54)."""

    symbols: Annotated[
        list[Annotated[str, Field(min_length=1)]],
        Field(min_length=1, max_length=MAX_DOWNLOAD_SYMBOLS),
    ]
    timeframe: Timeframe
    from_: IsoDate = Field(alias="from")
    to: IsoDate = Field(alias="to")
    segment: Segment = "equity_delivery"

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.from_ > self.to:
            raise ValueError("from date must be less than or equal to to date")
        return self


class ArchiveJobCreate(Contract):
    """Body of `POST /data-jobs/archive`: move ticks received before `before` (IST) to Parquet."""

    before: IsoDate


class DataJobPlanRequest(DataJobCreate):
    """Body of `POST /data-jobs/plan` (D57): a download to plan as a `draft`."""

    mode: DownloadMode = "skip_existing"


class DownloadSettings(Contract):
    """Pace on weekdays 09:15–15:30 IST (D57 (5)): `slow` ≤ 1 request/s, `full` 2/s."""

    market_hours_mode: MarketHoursMode


class DownloadSettingsUpdate(DownloadSettings):
    """Body of `PATCH /data-jobs/settings`."""


class DataJobDeleteResult(Contract):
    """Answer of `DELETE /data-jobs/{id}` (NOVA-095): the job is gone, with this many candles."""

    id: Id
    candles_deleted: Count
