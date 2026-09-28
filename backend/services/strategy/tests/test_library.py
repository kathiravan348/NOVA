"""NOVA-121 (D62 (7)): the strategy library data, `GET /strategies/library` and install."""

from collections import Counter
from typing import Any

from fastapi.testclient import TestClient
from nova_contracts.strategy import spec_param_problems
from nova_db.models import AuditEntry, Strategy, StrategyVersion
from nova_strategy.library import load_library
from nova_testing.parity import Parity
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

LIBRARY = "/api/v1/strategies/library"
CLOSE = {"kind": "price", "field": "close"}


def ind(name: str, **params: float) -> dict[str, Any]:
    return {"kind": "indicator", "name": name, "params": params}


def num(value: float) -> dict[str, Any]:
    return {"kind": "number", "value": value}


def cond(left: dict[str, Any], op: str, right: dict[str, Any]) -> dict[str, Any]:
    return {"left": left, "op": op, "right": right}


SMA200_FILTER = cond(CLOSE, "gt", ind("sma", period=200))
DELIVERY = {"segment": "equity_delivery", "exchange": "NSE", "timeframe": "1d"}

# Written by hand from docs/STRATEGY-LIBRARY.md, independently of the data files.
EXPECTED: dict[str, dict[str, Any]] = {
    "A04": {
        "mode": "rotation",
        **DELIVERY,
        "risk": {"stopLossPercent": None, "targetPercent": None},
        "regime": {"index": "NIFTY 50", "condition": SMA200_FILTER, "whenOff": "exit_all"},
        "rotation": {
            "rebalance": "monthly",
            "hold": 10,
            "keepWithin": 20,
            "score": [
                {"operand": ind("risk_adj_return", period=126), "weight": 1},
                {"operand": ind("risk_adj_return", period=252), "weight": 1},
            ],
        },
    },
    "B03": {
        "mode": "visual",
        **DELIVERY,
        "sizing": {"type": "percent_equity", "percent": 10},
        "risk": {"stopLossPercent": 8, "targetPercent": None},
        "portfolio": {"maxPositions": 10, "rank": {"by": ind("roc", period=126), "order": "desc"}},
        "regime": {"index": "NIFTY 50", "condition": SMA200_FILTER, "whenOff": "no_new_entries"},
        "entry": {
            "combinator": "all",
            "conditions": [
                cond(CLOSE, "gt", ind("sma", period=50)),
                cond(ind("sma", period=50), "gt", ind("sma", period=150)),
                cond(ind("sma", period=150), "gt", ind("sma", period=200)),
                cond(ind("sma", period=200), "gt", {**ind("sma", period=200), "offset": 21}),
                cond(CLOSE, "gte", {**ind("donchian_lower", period=252), "multiplier": 1.3}),
                cond(CLOSE, "gte", {**ind("donchian_upper", period=252), "multiplier": 0.75}),
                cond(CLOSE, "gt", {**ind("donchian_upper", period=20), "offset": 1}),
                cond(
                    {"kind": "price", "field": "volume"},
                    "gt",
                    {**ind("volume_sma", period=50), "multiplier": 1.4},
                ),
            ],
        },
        "exit": {"combinator": "any", "conditions": [cond(CLOSE, "lt", ind("sma", period=50))]},
    },
    "C11": {
        "mode": "visual",
        **DELIVERY,
        "sizing": {"type": "percent_equity", "percent": 5},
        "risk": {"stopLossPercent": 15, "targetPercent": 10},
        "averaging": {"dropPercent": 4, "maxAdds": 2},
        "portfolio": {"maxPositions": 10, "rank": {"by": ind("rsi", period=14), "order": "asc"}},
        "regime": {"index": "NIFTY 50", "condition": SMA200_FILTER, "whenOff": "no_new_entries"},
        "entry": {
            "combinator": "all",
            "conditions": [
                cond(ind("rsi", period=14), "lt", num(35)),
                cond(CLOSE, "gt", ind("sma", period=200)),
            ],
        },
        "exit": {"combinator": "any", "conditions": [cond(ind("rsi", period=14), "gt", num(70))]},
    },
    "G07": {
        "mode": "visual",
        "segment": "equity_intraday",
        "exchange": "NSE",
        "timeframe": "15m",
        "sizing": {"type": "percent_equity", "percent": 20},
        "risk": {"stopLossPercent": 1, "targetPercent": 2},
        "portfolio": {"maxPositions": 5, "rank": {"by": ind("roc", period=4), "order": "desc"}},
        "entry": {
            "combinator": "all",
            "conditions": [
                cond(CLOSE, "crosses_above", ind("pivot_r1")),
                cond(CLOSE, "gt", ind("vwap")),
                cond(
                    {"kind": "price", "field": "volume"},
                    "gt",
                    {**ind("volume_sma", period=20), "multiplier": 1.5},
                ),
            ],
        },
        "exit": {
            "combinator": "any",
            "conditions": [
                cond(CLOSE, "lt", ind("pivot")),
                cond(CLOSE, "gt", ind("pivot_r2")),
            ],
        },
    },
}
D05_RISK = {"stopLossPercent": 12, "targetPercent": None}


def _entries() -> dict[str, dict[str, Any]]:
    wire = load_library().model_dump(mode="json")
    return {entry["id"]: entry for entry in wire["entries"]}


def test_original_sixty_entries_in_seven_families() -> None:
    library = load_library()
    limits = {"A": 12, "B": 14, "C": 14, "D": 6, "E": 2, "F": 2, "G": 10}
    entries = [e for e in library.entries if int(e.id[1:]) <= limits[e.id[0]]]
    assert len(entries) == 60
    assert len({e.id for e in entries}) == 60 and len({e.name for e in entries}) == 60
    counts = Counter(e.id[0] for e in entries)
    assert counts == {"A": 12, "B": 14, "C": 14, "D": 6, "E": 2, "F": 2, "G": 10}
    families = {f.id for f in library.families}
    for entry in entries:
        assert entry.family in families
        assert spec_param_problems(entry.spec) == []
        intraday = entry.id.startswith("G")
        assert entry.spec.segment == ("equity_intraday" if intraday else "equity_delivery")
        assert entry.spec.timeframe == ("15m" if intraday else "1d")
        assert entry.backtest.from_.isoformat() == ("2023-01-02" if intraday else "2021-10-01")


def test_spot_checked_entries_equal_the_doc() -> None:
    entries = _entries()
    for entry_id, spec in EXPECTED.items():
        assert entries[entry_id]["spec"] == spec, entry_id
    d05 = entries["D05"]
    assert d05["name"] == "Weekly trend on daily bars"
    assert d05["spec"]["risk"] == D05_RISK and d05["spec"]["mode"] == "python"
    code = d05["spec"]["code"]
    assert code.startswith(
        "class Strategy:\n    def __init__(self):\n        self.last_day = None\n"
    )
    assert code.endswith("        self.prev_close = ctx.close\n        return signal\n")


def test_get_library_matches_the_contract(client: TestClient, parity: Parity) -> None:
    body = client.get(LIBRARY).json()
    parity.assert_valid(body, "StrategyLibrary")
    assert len(body["entries"]) == 100 and len(body["families"]) == 7


def _counts(engine: Engine) -> tuple[int, int]:
    with Session(engine) as db:
        strategies = db.scalar(select(func.count()).select_from(Strategy))
        audits = db.scalar(
            select(func.count())
            .select_from(AuditEntry)
            .where(AuditEntry.action == "strategy.create")
        )
    return int(strategies or 0), int(audits or 0)


def test_install_adds_drafts_with_audit_rows(
    client: TestClient, clean: Engine, parity: Parity
) -> None:
    response = client.post(f"{LIBRARY}/install", json={"ids": ["A01", "B03", "G07"]})

    assert response.status_code == 201
    created = response.json()
    for strategy in created:
        parity.assert_valid(strategy, "Strategy")
    assert [s["name"] for s in created] == [
        "12-1 momentum",
        "Trend template breakout",
        "Pivot R1 breakout",
    ]
    assert {s["status"] for s in created} == {"draft"}
    assert created[1]["versions"][0]["spec"] == EXPECTED["B03"]
    assert _counts(clean) == (3, 3)
    with Session(clean) as db:
        notes = set(db.scalars(select(StrategyVersion.note)))
    assert notes == {"From the library (A01)", "From the library (B03)", "From the library (G07)"}


def test_an_unknown_id_installs_nothing(client: TestClient, clean: Engine) -> None:
    response = client.post(f"{LIBRARY}/install", json={"ids": ["A01", "Z99"]})
    assert response.status_code == 400  # not an entry id at all

    response = client.post(f"{LIBRARY}/install", json={"ids": ["A01", "B99"]})
    assert response.status_code == 400
    assert "B99" in response.json()["error"]["message"]
    assert _counts(clean) == (0, 0)
    assert client.post(f"{LIBRARY}/install", json={"ids": ["A01", "A01"]}).status_code == 400
