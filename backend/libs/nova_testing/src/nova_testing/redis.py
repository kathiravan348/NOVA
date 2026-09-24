"""Redis fixture (D40): `NOVA_TEST_REDIS_URL` (backend-check uses db 15); skipped when unset.

Import into a package's `conftest.py`: `from nova_testing.redis import redis_client`.
"""

import os
from collections.abc import Iterator

import pytest
from redis import Redis


@pytest.fixture
def redis_client() -> Iterator[Redis]:
    url = os.environ.get("NOVA_TEST_REDIS_URL")
    if not url:
        pytest.skip("NOVA_TEST_REDIS_URL is not set (Redis tests run in backend-check)")
    client = Redis.from_url(url)
    client.flushdb()
    yield client
    client.flushdb()
    client.close()
