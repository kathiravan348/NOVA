"""WebSocket messages (D57): mirror `frontend/packages/contracts/src/realtime.ts`."""

from typing import Annotated, Literal

from pydantic import Field

from nova_contracts.common import Contract
from nova_contracts.data_job import DataJob


class RealtimeHello(Contract):
    """First message after the socket opens."""

    type: Literal["hello"]


class RealtimePing(Contract):
    """Sent every 25 s; the client answers `{"type": "pong"}`."""

    type: Literal["ping"]


class DataJobUpdated(Contract):
    """A data job was created or changed (any type, D57)."""

    type: Literal["data_job.updated"]
    data: DataJob


RealtimeMessage = Annotated[
    RealtimeHello | RealtimePing | DataJobUpdated, Field(discriminator="type")
]
