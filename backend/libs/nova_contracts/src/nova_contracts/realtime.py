"""WebSocket messages (D57): mirror `frontend/packages/contracts/src/realtime.ts`."""

from typing import Annotated, Literal

from pydantic import Field

from nova_contracts.common import Contract, Id
from nova_contracts.data_job import DataJob
from nova_contracts.live import LiveTick


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


class DeletedJobRef(Contract):
    id: Id


class DataJobDeleted(Contract):
    """A data job was deleted (NOVA-095)."""

    type: Literal["data_job.deleted"]
    data: DeletedJobRef


class LiveTickMessage(Contract):
    type: Literal["live.tick"]
    data: LiveTick


RealtimeMessage = Annotated[
    RealtimeHello | RealtimePing | DataJobUpdated | DataJobDeleted | LiveTickMessage,
    Field(discriminator="type"),
]
