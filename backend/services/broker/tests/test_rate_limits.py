from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from nova_broker.limiter import RateLimiter
from nova_broker.main import create_app
from nova_broker.settings import BrokerSettings
from nova_db.models import AuditEntry, RateLimitRule
from nova_testing.parity import Parity
from redis import Redis
from sqlalchemy import Engine, delete, select
from sqlalchemy.orm import Session

LIMITS = "/api/v1/broker/rate-limits"


def test_new_accounts_get_the_kite_limits_with_headroom(
    client: TestClient, account_id: str, parity: Parity
) -> None:
    body = client.get(LIMITS).json()

    for limit in body:
        parity.assert_valid(limit, "RateLimit")
    assert [limit["endpoint"] for limit in body] == ["quote", "historical", "orders", "other"]
    orders = body[2]["rules"]
    assert [(r["window"], r["brokerLimit"], r["novaLimit"]) for r in orders] == [
        ("second", 10, 9),
        ("minute", 400, 360),
        ("day", 5000, 4500),
    ]
    assert body[0]["rules"][0]["novaLimit"] == 1  # 90% of 1, but at least 1
    assert orders[2]["resetsAt"] is not None and orders[0]["resetsAt"] is None


def test_used_and_throttled_come_from_the_limiter(
    client: TestClient, app: FastAPI, account_id: str
) -> None:
    limiter: RateLimiter = app.state.limiter
    now = datetime.now(UTC)
    for _ in range(3):
        limiter.acquire(account_id, "quote", {"second": 1}, now)

    quote = client.get(LIMITS).json()[0]

    assert quote["rules"][0]["used"] == 1
    assert quote["throttledToday"] == 2


def test_patch_changes_the_nova_limit_and_is_audited(
    client: TestClient, account_id: str, clean: Engine
) -> None:
    response = client.patch(
        f"{LIMITS}/{account_id}/orders", json={"window": "day", "novaLimit": 4000}
    )

    assert response.status_code == 204
    orders = client.get(LIMITS).json()[2]
    assert orders["rules"][2]["novaLimit"] == 4000
    with Session(clean) as db:
        entry = db.scalars(
            select(AuditEntry).where(AuditEntry.action == "broker.rate_limit_update")
        ).one()
    assert entry.summary == "orders per day: 4,500 → 4,000"
    assert entry.target_id == account_id and entry.actor_id == "usr_owner"


@pytest.mark.parametrize(
    ("endpoint", "body", "status"),
    [
        ("orders", {"window": "day", "novaLimit": 5001}, 400),
        ("quote", {"window": "day", "novaLimit": 1}, 400),
        ("orders", {"window": "day", "novaLimit": 0}, 400),
        ("orders", {"window": "hour", "novaLimit": 1}, 400),
        ("nope", {"window": "day", "novaLimit": 1}, 404),
    ],
)
def test_bad_updates_are_refused(
    client: TestClient, account_id: str, endpoint: str, body: dict[str, object], status: int
) -> None:
    response = client.patch(f"{LIMITS}/{account_id}/{endpoint}", json=body)

    assert response.status_code == status


def test_missing_rules_are_restored_at_start_up(
    settings: BrokerSettings,
    account_id: str,
    clean: Engine,
    redis_client: Redis,
    caller_headers: dict[str, str],
) -> None:
    with Session(clean) as db:
        db.execute(delete(RateLimitRule))
        db.commit()

    app = create_app(settings, redis=redis_client)
    with TestClient(app, headers=caller_headers) as restarted:
        assert len(restarted.get(LIMITS).json()) == 4
