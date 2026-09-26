"""NSE index member lists for Atlas (D56): fetched through a fake NSE, never the real site."""

from collections.abc import Callable, Iterator

import httpx2
import pytest
from fastapi.testclient import TestClient
from nova_broker.main import create_app
from nova_broker.settings import BrokerSettings
from nova_testing.kite import FakeKite
from redis import Redis

URL = "/internal/nse/constituents"
NIFTY50 = (
    "﻿Company Name,Industry,Symbol,Series,ISIN Code\r\n"
    "Infosys Ltd.,Information Technology,INFY,EQ,INE009A01021\r\n"
    "Tata Consultancy Services Ltd.,Information Technology,TCS,EQ,INE467B01029\r\n"
    "Some Bond,Financial Services,SOMEBOND,N1,INE000000000\r\n"
)
Handler = Callable[[httpx2.Request], httpx2.Response]


@pytest.fixture
def nse() -> dict[str, Handler]:
    """The fake NSE's behaviour; tests replace `handle`."""
    return {"handle": lambda _: httpx2.Response(200, text=NIFTY50)}


@pytest.fixture
def service(
    settings: BrokerSettings, kite: FakeKite, redis_client: Redis, nse: dict[str, Handler]
) -> Iterator[TestClient]:
    app = create_app(
        settings,
        kite_transport=httpx2.MockTransport(kite.handle),
        nse_transport=httpx2.MockTransport(lambda request: nse["handle"](request)),
        redis=redis_client,
    )
    with TestClient(app, headers={"x-nova-internal-token": "internal-test-token"}) as client:
        yield client


def test_members_are_the_eq_rows(service: TestClient, nse: dict[str, Handler]) -> None:
    seen: list[str] = []

    def handle(request: httpx2.Request) -> httpx2.Response:
        seen.append(str(request.url))
        return httpx2.Response(200, text=NIFTY50)

    nse["handle"] = handle
    response = service.get(URL, params={"file": "ind_nifty50list.csv"})

    assert response.status_code == 200
    assert response.json() == [
        {"symbol": "INFY", "company": "Infosys Ltd.", "industry": "Information Technology"},
        {
            "symbol": "TCS",
            "company": "Tata Consultancy Services Ltd.",
            "industry": "Information Technology",
        },
    ]
    assert seen == ["https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv"]


@pytest.mark.parametrize(
    ("handle", "message"),
    [
        (lambda _: httpx2.Response(403, text="denied"), "NSE answered 403"),
        (lambda _: httpx2.Response(200, text="<html>maintenance</html>"), "not an NSE"),
        (
            lambda _: httpx2.Response(200, text="Company Name,Industry,Symbol,Series\r\n"),
            "no stocks",
        ),
    ],
)
def test_nse_problems_are_502(
    service: TestClient, nse: dict[str, Handler], handle: Handler, message: str
) -> None:
    nse["handle"] = handle
    response = service.get(URL, params={"file": "ind_nifty50list.csv"})

    assert response.status_code == 502 and message in response.json()["error"]["message"]


def test_a_timeout_is_502(service: TestClient, nse: dict[str, Handler]) -> None:
    def slow(request: httpx2.Request) -> httpx2.Response:
        raise httpx2.ReadTimeout("slow", request=request)

    nse["handle"] = slow
    response = service.get(URL, params={"file": "ind_nifty50list.csv"})

    assert response.status_code == 502
    assert response.json()["error"]["message"] == "NSE did not answer for ind_nifty50list.csv"


@pytest.mark.parametrize("file", ["../secrets.csv", "ind_nifty50list.txt", "IND_X.csv", ""])
def test_bad_file_names_are_400(service: TestClient, file: str) -> None:
    assert service.get(URL, params={"file": file}).status_code == 400


def test_needs_the_internal_token(service: TestClient) -> None:
    response = service.get(
        URL, params={"file": "ind_nifty50list.csv"}, headers={"x-nova-internal-token": "wrong"}
    )

    assert response.status_code == 401
