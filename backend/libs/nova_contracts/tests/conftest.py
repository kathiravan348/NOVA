import pytest
from nova_testing.parity import Parity


@pytest.fixture(scope="session")
def parity() -> Parity:
    return Parity()
