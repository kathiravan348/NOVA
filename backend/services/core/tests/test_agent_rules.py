import pytest
from nova_core.agent_rules import PREFIX_RULES, classify
from nova_core.gateway import ROUTES


def test_every_gateway_prefix_has_an_explicit_rule() -> None:
    assert set(ROUTES) <= set(PREFIX_RULES)
    assert PREFIX_RULES["broker"] == "blocked"


@pytest.mark.parametrize(
    "prefix", ["strategies", "backtests", "research-profiles", "market-data", "data-jobs"]
)
@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
def test_gateway_methods(prefix: str, method: str) -> None:
    expected = "free" if method == "GET" else "blocked" if method == "HEAD" else "held"
    assert classify(method, f"/{prefix}/anything") == expected


@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE"])
@pytest.mark.parametrize(
    "path",
    [
        "/broker",
        "/broker/accounts",
        "/orders",
        "/unknown",
        "/agent-account",
        "/approvals/apr_1/approve",
        "/approvals/apr_1/reject",
        "/strategies/../broker/accounts",
        "/strategies/%2e%2e/broker/accounts",
    ],
)
def test_blocked_routes(method: str, path: str) -> None:
    assert classify(method, path) == "blocked"


@pytest.mark.parametrize("path", ["/me", "/audit", "/approvals", "/ws"])
def test_local_reads(path: str) -> None:
    assert classify("GET", path) == "free"
    assert classify("PATCH", path) == "blocked"


def test_only_the_exact_plan_write_is_free() -> None:
    assert classify("POST", "/data-jobs/plan") == "free"
    assert classify("POST", "/data-jobs/plan/extra") == "held"
    assert classify("POST", "/data-jobs/plan/") == "held"
    assert classify("DELETE", "/data-jobs/plan") == "held"
    assert classify("POST", "/auth/login") == "free"
    assert classify("POST", "/auth/logout") == "free"
