"""Python strategies in the sandbox (D47)."""

import ast
import re
import subprocess
import sys
from datetime import datetime, time, timedelta
from pathlib import Path
from typing import Any

import pytest
from nova_backtest import sandbox, sandbox_runner
from nova_backtest.bars import IST, Bar
from nova_backtest.engine import EngineError
from nova_backtest.rules import RuleSignals
from nova_backtest.sandbox import PythonSignals, check_code, run_python
from nova_backtest.simulate import simulate
from nova_contracts import Charges, RuleGroup, Sizing
from nova_contracts.strategy import Risk
from pydantic import TypeAdapter

DAY0 = datetime.combine(datetime(2026, 9, 1).date(), time(0), tzinfo=IST)
PRICES = [(100, 101, 99, 100), (104, 107, 103, 106), (107, 108, 106, 107), (105, 106, 98, 99)]
PRICES.append((98, 99, 97, 98))
BARS = {
    "INFY": [
        Bar(DAY0 + timedelta(days=i), o * 100, h * 100, lo * 100, c * 100, 1_000)
        for i, (o, h, lo, c) in enumerate(PRICES)
    ]
}
THRESHOLDS = """
class Strategy:
    def __init__(self):
        self.seen = 0

    def on_bar(self, ctx):
        self.seen = self.seen + 1
        if ctx.close > 105:
            return "enter"
        if ctx.close < 100:
            return "exit"
        return None
"""


def _rule(op: str, value: float) -> dict[str, Any]:
    return {
        "combinator": "all",
        "conditions": [
            {
                "left": {"kind": "price", "field": "close"},
                "op": op,
                "right": {"kind": "number", "value": value},
            }
        ],
    }


def test_a_python_strategy_trades_like_the_same_visual_one() -> None:
    sizing = TypeAdapter[Sizing](Sizing).validate_python({"type": "fixed_qty", "qty": 10})
    risk = Risk(stop_loss_percent=None, target_percent=None)
    zero = Charges(
        brokerage_paise=0,
        stt_paise=0,
        exchange_txn_paise=0,
        sebi_fee_paise=0,
        stamp_duty_paise=0,
        gst_paise=0,
        dp_paise=0,
        total_paise=0,
    )
    visual = RuleSignals(
        BARS, RuleGroup.model_validate(_rule("gt", 105)), RuleGroup.model_validate(_rule("lt", 100))
    )
    python = PythonSignals(run_python(THRESHOLDS, BARS))

    def run(signals: RuleSignals | PythonSignals) -> list[tuple[int, int]]:
        result = simulate(BARS, signals, sizing, risk, 10_000_000, DAY0, lambda *_: zero)
        return [(t.entry_price, t.exit_price) for t in result.trades]

    assert run(python) == run(visual) == [(10_700, 9_800)]


def test_context_helpers() -> None:
    code = """
class Strategy:
    def on_bar(self, ctx):
        if ctx.sma(2) is None:
            return None
        if ctx.close >= ctx.highest(2) and len(ctx.closes) == ctx.index + 1:
            return "enter"
        return "exit"
"""
    assert run_python(code, BARS)["INFY"] == [None, "enter", "enter", "exit", "exit"]


@pytest.mark.parametrize(
    ("code", "reason"),
    [
        ("import os", "imports"),
        ("from os import path", "imports"),
        ("x = ().__class__", "attribute __class__"),
        ("_hidden = 1", "names starting with _"),
        ("def _helper():\n    pass", "function names starting with _"),
        ("def f():\n    global x", "global"),
        ("eval('1')", "eval"),
        ("getattr(1, 'real')", "getattr"),
        ("'{0.real}'.format(1)", "attribute format"),
    ],
)
def test_forbidden_code_is_refused_with_its_line(code: str, reason: str) -> None:
    with pytest.raises(EngineError, match=f"not allowed: {reason}.*line [12]"):
        check_code(code + "\nclass Strategy:\n    pass\n")


def test_a_strategy_class_and_valid_syntax_are_required() -> None:
    with pytest.raises(EngineError, match="class named Strategy"):
        check_code("x = 1")
    with pytest.raises(EngineError, match="syntax error"):
        check_code("class Strategy(:")


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ("        return 1 / 0", "ZeroDivisionError: division by zero (line 4)"),
        ('        return "buy"', "on_bar must return"),
        ("        return undefined_name", "NameError"),
    ],
)
def test_user_errors_are_reported(body: str, message: str) -> None:
    code = f"class Strategy:\n    def on_bar(self, ctx):\n        x = 1\n{body}\n"

    with pytest.raises(EngineError, match=re.escape(message)):
        run_python(code, BARS)


def test_endless_loops_are_stopped() -> None:
    code = "class Strategy:\n    def on_bar(self, ctx):\n        while True:\n            pass\n"

    with pytest.raises(EngineError, match="ran longer than 2 s"):
        run_python(code, BARS, timeout=2)


def test_the_child_gets_no_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}
    real_run = subprocess.run

    def spy(*args: Any, **kwargs: Any) -> Any:
        seen.update(kwargs, command=args[0])
        return real_run(*args, **kwargs)

    monkeypatch.setenv("NOVA_DATABASE_URL", "postgresql://secret")
    monkeypatch.setattr(subprocess, "run", spy)
    run_python(THRESHOLDS, BARS)

    assert "NOVA_DATABASE_URL" not in seen["env"]
    assert set(seen["env"]) <= ({"SYSTEMROOT"} if sys.platform == "win32" else set())
    assert seen["command"][1] == "-I"


def test_the_child_has_no_dangerous_builtins_even_without_the_check(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Defence in depth: skip the AST check and the child still cannot open files."""
    monkeypatch.setattr(sandbox, "check_code", lambda code: None)
    code = "class Strategy:\n    def on_bar(self, ctx):\n        return open('x')\n"

    with pytest.raises(EngineError, match="NameError: name 'open' is not defined"):
        run_python(code, BARS)


# 40 daily closes: 20 falling (RSI(14) ends below 30), then 20 rising (RSI climbs back above 30).
SWING = [150 - 3 * i for i in range(20)] + [93 + 4 * i for i in range(20)]
SWING_BARS = {
    "INFY": [
        Bar(DAY0 + timedelta(days=i), c * 100, (c + 1) * 100, (c - 1) * 100, c * 100, 1_000)
        for i, c in enumerate(SWING)
    ]
}
RSI_CODE = """
class Strategy:
    def on_bar(self, ctx):
        value = ctx.rsi(14)
        if value is not None and value < 30:
            return "enter"
        return None
"""


def test_ctx_rsi_signals_match_the_visual_rule() -> None:
    """D51: a Python call and a visual rule use the same indicator code."""
    rule = {
        "combinator": "all",
        "conditions": [
            {
                "left": {"kind": "indicator", "name": "rsi", "params": {"period": 14}},
                "op": "lt",
                "right": {"kind": "number", "value": 30},
            }
        ],
    }
    group = RuleGroup.model_validate(rule)
    visual = RuleSignals(SWING_BARS, group, group)
    python = PythonSignals(run_python(RSI_CODE, SWING_BARS))

    expected = [visual.enter("INFY", i) for i in range(40)]
    assert any(expected) and not all(expected[14:])
    assert [python.enter("INFY", i) for i in range(40)] == expected


@pytest.mark.parametrize(
    ("call", "reason"),
    [
        ("ctx.rsi(n)", "ctx.rsi settings must be plain numbers"),
        ("ctx.rsi(14, 3)", "ctx.rsi takes at most 1 settings"),
        ("ctx.foo(1)", "ctx has no foo()"),
        ("ctx.macd(fast=30, slow=10)", "MACD line fast must be less than slow"),
        ("ctx.rsi(period=14, period2=3)", "ctx.rsi has no setting period2"),
        ("ctx.rsi(14, ago=n)", "ctx.rsi ago must be a whole number from 0 to 500"),
        ("ctx.rsi(True)", "ctx.rsi settings must be plain numbers"),
    ],
)
def test_bad_indicator_calls_are_refused_with_their_line(call: str, reason: str) -> None:
    code = f"class Strategy:\n    def on_bar(self, ctx):\n        n = 3\n        return {call}\n"

    with pytest.raises(EngineError, match=re.escape(reason) + r".*\(line 4\)"):
        check_code(code)


def test_existing_helpers_still_take_variables() -> None:
    code = "class Strategy:\n    def on_bar(self, ctx):\n        n = 5\n        return ctx.sma(n)\n"

    assert check_code(code) == {}
    assert list(check_code(RSI_CODE)) == ["rsi(period=14.0)"]


def test_ago_reads_an_earlier_bar() -> None:
    catalog = {"rsi": [["period", 14]]}
    series = {"rsi(period=14.0)": [10.0, 20.0, 30.0]}
    ctx = sandbox_runner.Context(
        "INFY", 2, ["t", 1, 1, 1, 1, 1], sandbox_runner.Closes([1.0] * 3, 3), catalog, series
    )

    assert ctx.rsi(14) == 30.0
    assert ctx.rsi(period=14, ago=1) == 20.0
    assert ctx.rsi(14, ago=3) is None
    for name in ("nope", "_hidden"):  # unknown and private names stay closed
        with pytest.raises(AttributeError):
            getattr(ctx, name)


def test_the_runner_imports_only_the_standard_library() -> None:
    tree = ast.parse(Path(sandbox.RUNNER).read_text(encoding="utf-8"))
    modules = {
        alias.name.split(".")[0]
        for node in ast.walk(tree)
        if isinstance(node, ast.Import)
        for alias in node.names
    } | {
        (node.module or "").split(".")[0]
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom)
    }

    assert modules and modules <= sys.stdlib_module_names
