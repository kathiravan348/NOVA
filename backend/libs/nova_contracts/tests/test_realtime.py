import json

import pytest
from nova_contracts import DataJob, DataJobUpdated, RealtimeMessage
from nova_testing.parity import Parity
from pydantic import TypeAdapter, ValidationError

MESSAGE: TypeAdapter[RealtimeMessage] = TypeAdapter(RealtimeMessage)


def test_each_message_round_trips_and_matches_schema(parity: Parity) -> None:
    job = parity.mock("dataJobs")[0]
    for raw in ({"type": "hello"}, {"type": "ping"}, {"type": "data_job.updated", "data": job}):
        dumped = MESSAGE.dump_python(MESSAGE.validate_json(json.dumps(raw)), mode="json")

        assert dumped == raw
        parity.assert_valid(dumped, "RealtimeMessage")


def test_data_job_updated_carries_a_full_job(parity: Parity) -> None:
    job = DataJob.model_validate_json(json.dumps(parity.mock("dataJobs")[0]))

    message = MESSAGE.validate_python(DataJobUpdated(type="data_job.updated", data=job))

    assert isinstance(message, DataJobUpdated)


@pytest.mark.parametrize(
    "raw", [{"type": "pong"}, {"type": "hello", "extra": 1}, {"type": "data_job.updated"}]
)
def test_unknown_or_broken_messages_are_rejected(raw: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        MESSAGE.validate_json(json.dumps(raw))
