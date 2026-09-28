"""NOVA-144: fixed research candidates, preservation and atomic installation."""

import hashlib
import json
from collections import Counter

from fastapi.testclient import TestClient
from nova_db.models import AuditEntry, Strategy
from nova_strategy.library import ENTRY_FILES, _read, load_library
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

ORIGINAL_HASHES = {
    "a_rotation": "e96f062a7737bb370de2014dab286029f797438b8d839107609fb7ac6b25fa79",
    "b_trend": "0cec5ff18960ded1fe7b28b23b5a57a88e2caf47558fea8ee06003231b4375ce",
    "c_pullback": "f81abea2037c977e4255e64eecd5122c9513e1500570e543405fffd72f7782e2",
    "d_patterns": "a4a51b9498fdde45b2c20151f20efa3b9473a5cf51129f01917f9bf539091d29",
    "ef_hold_baseline": "1ac3eaaa30684f557b55f080f496975de241ca513457084096b0527f7eda08aa",
    "g_intraday": "e8862d74ea4235fa313475265bc490a7b1c5a58fb48577b59e90268d75a22093",
}

LIMITS = {"A": 12, "B": 14, "C": 14, "D": 6, "E": 2, "F": 2, "G": 10}


def test_original_data_is_preserved() -> None:
    for filename in ENTRY_FILES:
        original = [
            e for e in json.loads(_read(filename)) if int(e["id"][1:]) <= LIMITS[e["id"][0]]
        ]
        packed = json.dumps(original, sort_keys=True, separators=(",", ":")).encode()
        assert hashlib.sha256(packed).hexdigest() == ORIGINAL_HASHES[filename.removesuffix(".json")]


def test_expansion_counts_and_defaults() -> None:
    entries = load_library().entries
    assert len(entries) == len({e.id for e in entries}) == len({e.name for e in entries}) == 100
    assert Counter(e.id[0] for e in entries) == dict(A=16, B=22, C=20, D=6, E=4, F=2, G=30)
    new = [e for e in entries if int(e.id[1:]) > LIMITS[e.id[0]]]
    intraday = [e for e in new if e.spec.segment == "equity_intraday"]
    swing = [e for e in new if e.spec.segment == "equity_delivery" and e.spec.timeframe != "1d"]
    assert len(new) == 40
    assert Counter(e.spec.timeframe for e in intraday) == {
        "1m": 2,
        "3m": 3,
        "5m": 5,
        "15m": 4,
        "30m": 4,
        "1h": 2,
    }
    assert Counter(e.spec.timeframe for e in swing) == {"15m": 4, "30m": 4, "1h": 4}
    for entry in new:
        assert entry.backtest.universe.model_dump(by_alias=True) == {
            "type": "index",
            "index": "NIFTY 50",
        }
        assert entry.backtest.benchmark == "NIFTY 50"
        assert entry.backtest.initial_capital_paise == 100_000_000
        assert entry.backtest.from_.isoformat() == "2023-01-02"
        assert entry.backtest.to.isoformat() == "2024-12-31"
        if entry.spec.mode != "rotation":
            assert entry.spec.averaging is None


def test_independent_rotation_and_breakout_settings() -> None:
    entries = {e.id: e.model_dump(mode="json") for e in load_library().entries}
    rotation = entries["A14"]["spec"]["rotation"]
    assert rotation["rebalance"] == "quarterly"
    assert (rotation["hold"], rotation["keepWithin"]) == (15, 25)
    assert rotation["score"] == [
        {
            "operand": {"kind": "indicator", "name": "volatility", "params": {"period": 252}},
            "weight": -1,
        }
    ]
    entry = entries["G12"]["spec"]["entry"]["conditions"][0]
    assert entry == {
        "left": {"kind": "price", "field": "close"},
        "op": "gt",
        "right": {
            "kind": "indicator",
            "name": "donchian_upper",
            "params": {"period": 5},
            "offset": 1,
        },
    }
    recovery = entries["G17"]["spec"]
    assert recovery["risk"] == {"stopLossPercent": 0.8, "targetPercent": 1.6, "maxHoldBars": 12}
    assert recovery["entry"]["conditions"][0] == {
        "left": {"kind": "price", "field": "close", "offset": 1},
        "op": "lt",
        "right": {"kind": "indicator", "name": "prev_day_low", "params": {}},
    }


def test_install_all_100_atomically(client: TestClient, clean: Engine) -> None:
    ids = [e.id for e in load_library().entries]
    response = client.post("/api/v1/strategies/library/install", json={"ids": ids})
    assert response.status_code == 201
    assert len(response.json()) == 100
    assert {s["status"] for s in response.json()} == {"draft"}
    with Session(clean) as db:
        assert db.scalar(select(func.count()).select_from(Strategy)) == 100
        assert (
            db.scalar(
                select(func.count())
                .select_from(AuditEntry)
                .where(AuditEntry.action == "strategy.create")
            )
            == 100
        )
