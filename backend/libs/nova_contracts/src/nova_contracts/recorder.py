"""Tick recorder setting (D54): mirrors `frontend/packages/contracts/src/recorder.ts`."""

from typing import Annotated, Literal

from pydantic import Field

from nova_contracts.common import Contract, Id, UtcDateTime
from nova_contracts.universe import Symbol

# Kite streams at most this many instruments over one WebSocket.
MAX_RECORDER_SYMBOLS = 3000

RecorderState = Literal["off", "waiting", "recording", "no_login"]


class RecorderSettingsUpdate(Contract):
    """Body of `PUT /broker/recorder`. `symbols` empty = every stock synced with Kite."""

    enabled: bool
    symbols: Annotated[list[Symbol], Field(max_length=MAX_RECORDER_SYMBOLS)]


class RecorderSettings(RecorderSettingsUpdate):
    """`state`: off; waiting (outside 09:15-15:30 IST on weekdays); recording (`jobId` is the
    running `tick_record` job); no_login (market hours but no live Kite session)."""

    state: RecorderState
    job_id: Id | None
    updated_at: UtcDateTime
