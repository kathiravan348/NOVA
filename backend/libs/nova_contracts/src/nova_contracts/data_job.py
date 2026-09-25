"""DataJob: mirrors `frontend/packages/contracts/src/dataJob.ts`."""

from typing import Annotated, Literal, Self

from pydantic import Field, model_validator

from nova_contracts.common import Contract, Exchange, Id, IsoDate, Segment, Timeframe, UtcDateTime

DataJobType = Literal["historical_download", "tick_record", "archive"]
DataJobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class DataJob(Contract):
    id: Id
    type: DataJobType
    status: DataJobStatus
    exchange: Exchange
    segment: Segment
    symbols: Annotated[list[Annotated[str, Field(min_length=1)]], Field(min_length=1)]
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

    @model_validator(mode="after")
    def _rules(self) -> Self:
        if self.type == "historical_download" and (
            self.timeframe is None or self.from_ is None or self.to is None
        ):
            raise ValueError("historical_download requires timeframe, from and to")
        if self.type == "tick_record" and self.timeframe is not None:
            raise ValueError("tick_record requires timeframe to be null")
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
