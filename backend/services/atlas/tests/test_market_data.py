from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from nova_atlas.main import create_app
from nova_atlas.settings import AtlasSettings
from nova_db.models import Candle, DataJob, Instrument
from nova_testing.parity import Parity
from sqlalchemy import Engine
from sqlalchemy.orm import Session

IST = ZoneInfo("Asia/Kolkata")
INSTRUMENTS = "/api/v1/market-data/instruments"
TOKEN = "internal-test-token"  # as in conftest
CANDLES = "/api/v1/market-data/candles"


def _bar(symbol: str, timeframe: str, at: datetime, close: int, volume: int = 100) -> Candle:
    return Candle(
        exchange="NSE",
        symbol=symbol,
        timeframe=timeframe,
        ts=at.astimezone(UTC),
        open_paise=close - 50,
        high_paise=close + 100,
        low_paise=close - 100,
        close_paise=close,
        volume=volume,
    )


@pytest.fixture
def seeded(clean: Engine) -> Engine:
    """INFY: 30 daily bars (2026-08-01 … 08-30) + 2 five-minute bars; TCS: no candles."""
    with Session(clean) as db:
        db.add_all(
            [
                Instrument(
                    exchange="NSE",
                    symbol="INFY",
                    name="Infosys",
                    segment="equity_delivery",
                    sector="Information Technology",
                    indices=["NIFTY 50"],
                    lot_size=300,
                    instrument_token=408065,
                ),
                Instrument(
                    exchange="NSE",
                    symbol="TCS",
                    name="Tata Consultancy Services",
                    segment="equity_delivery",
                    sector="Information Technology",
                    indices=["NIFTY 50"],
                    instrument_token=2953217,
                ),
            ]
        )
        for i in range(30):
            day = datetime.combine(date(2026, 8, 1) + timedelta(days=i), time(0, 0), tzinfo=IST)
            db.add(_bar("INFY", "1d", day, close=150_000 + i * 100, volume=1_000 + i))
        morning = datetime(2026, 8, 30, 9, 15, tzinfo=IST)
        db.add_all(
            [
                _bar("INFY", "5m", morning, 152_900),
                _bar("INFY", "5m", morning + timedelta(minutes=5), 153_000),
            ]
        )
        db.commit()
    return clean


def test_instruments_with_daily_data_get_computed_stats(
    client: TestClient, seeded: Engine, parity: Parity
) -> None:
    body = client.get(INSTRUMENTS).json()

    assert [i["symbol"] for i in body] == ["INFY"]  # TCS has no candles yet
    infy = body[0]
    parity.assert_valid(infy, "Instrument")
    assert infy["lastClosePaise"] == 152_900
    assert infy["changePercent"] == round(100 * 100 / 152_800, 2)
    assert infy["high52wPaise"] == 153_000 and infy["low52wPaise"] == 149_900
    assert infy["avgDailyVolume"] == sum(1_010 + i for i in range(20)) // 20
    assert infy["timeframes"] == ["5m", "1d"]
    assert (infy["dataFrom"], infy["dataTo"]) == ("2026-08-01", "2026-08-30")
    assert infy["lotSize"] == 300 and infy["indices"] == ["NIFTY 50"]


def test_daily_candles_default_to_the_last_year_as_ist_dates(
    client: TestClient, seeded: Engine, parity: Parity
) -> None:
    body = client.get(CANDLES, params={"symbol": "INFY", "timeframe": "1d"}).json()

    assert len(body) == 30
    assert (body[0]["time"], body[-1]["time"]) == ("2026-08-01", "2026-08-30")
    for bar in body:
        parity.assert_valid(bar, "Candle")


def test_a_range_limits_the_bars(client: TestClient, seeded: Engine) -> None:
    params = {"symbol": "INFY", "timeframe": "1d", "from": "2026-08-10", "to": "2026-08-12"}

    body = client.get(CANDLES, params=params).json()

    assert [bar["time"] for bar in body] == ["2026-08-10", "2026-08-11", "2026-08-12"]


def test_intraday_times_are_utc(client: TestClient, seeded: Engine) -> None:
    body = client.get(CANDLES, params={"symbol": "INFY", "timeframe": "5m"}).json()

    assert [bar["time"] for bar in body] == ["2026-08-30T03:45:00Z", "2026-08-30T03:50:00Z"]


def test_known_symbol_without_data_is_empty_and_unknown_is_404(
    client: TestClient, seeded: Engine
) -> None:
    assert client.get(CANDLES, params={"symbol": "TCS", "timeframe": "1d"}).json() == []
    assert client.get(CANDLES, params={"symbol": "NOPE", "timeframe": "1d"}).status_code == 404


@pytest.mark.parametrize(
    "params",
    [
        {"timeframe": "2h"},
        {"from": "2026-08-12", "to": "2026-08-10"},
        {"timeframe": "5m", "from": "2026-01-01", "to": "2026-08-30"},
    ],
)
def test_bad_candle_requests_are_invalid(
    client: TestClient, seeded: Engine, params: dict[str, str]
) -> None:
    response = client.get(CANDLES, params={"symbol": "INFY", "timeframe": "1d"} | params)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_coverage_is_listed_per_timeframe(client: TestClient, seeded: Engine) -> None:
    infy = client.get(INSTRUMENTS).json()[0]

    assert infy["coverage"] == [
        {"timeframe": "5m", "from": "2026-08-30", "to": "2026-08-30"},
        {"timeframe": "1d", "from": "2026-08-01", "to": "2026-08-30"},
    ]


def test_a_stock_with_only_intraday_bars_gets_prices_from_them(
    client: TestClient, seeded: Engine, parity: Parity
) -> None:
    with Session(seeded) as db:
        for offset, day in enumerate((date(2026, 9, 2), date(2026, 9, 3))):
            open_ = datetime.combine(day, time(9, 15), tzinfo=IST)
            for minute, close in enumerate((300_000, 301_000 + offset * 5_000)):
                db.add(_bar("TCS", "1m", open_ + timedelta(minutes=minute), close, volume=10))
        db.add(
            _bar("TCS", "5m", datetime(2026, 9, 1, 9, 15, tzinfo=IST), 299_000)
        )  # coarser: unused
        db.commit()

    tcs = next(i for i in client.get(INSTRUMENTS).json() if i["symbol"] == "TCS")

    parity.assert_valid(tcs, "Instrument")
    assert tcs["lastClosePaise"] == 306_000  # last 1m close of the last day
    assert tcs["changePercent"] == round(5_000 * 100 / 301_000, 2)  # vs the day before's close
    assert (tcs["low52wPaise"], tcs["high52wPaise"]) == (299_900, 306_100)
    assert tcs["avgDailyVolume"] == 20
    assert tcs["timeframes"] == ["1m", "5m"]
    assert (tcs["dataFrom"], tcs["dataTo"]) == ("2026-09-01", "2026-09-03")


def test_the_list_is_cached_until_a_download_finishes(database_url: str, seeded: Engine) -> None:
    settings = AtlasSettings.model_validate(
        {
            "database_url": database_url,
            "redis_url": "redis://unused:6379/0",
            "internal_token": TOKEN,
        }
    )
    headers = {
        "x-nova-internal-token": TOKEN,
        "x-nova-user-id": "usr_owner",
        "x-nova-user-name": "Owner",
    }
    with TestClient(create_app(settings), headers=headers) as cached:
        assert [i["symbol"] for i in cached.get(INSTRUMENTS).json()] == ["INFY"]
        with Session(seeded) as db:
            db.add(_bar("TCS", "1m", datetime(2026, 9, 2, 9, 15, tzinfo=IST), 300_000))
            db.commit()
        assert [i["symbol"] for i in cached.get(INSTRUMENTS).json()] == ["INFY"]  # still cached
        with Session(seeded) as db:
            db.add(
                DataJob(
                    id="job_done",
                    type="historical_download",
                    status="completed",
                    exchange="NSE",
                    segment="equity_delivery",
                    symbols=["TCS"],
                    timeframe="1m",
                    date_from=date(2026, 9, 2),
                    date_to=date(2026, 9, 2),
                    progress_percent=100,
                    finished_at=datetime.now(UTC),
                )
            )
            db.commit()
        assert [i["symbol"] for i in cached.get(INSTRUMENTS).json()] == ["INFY", "TCS"]
