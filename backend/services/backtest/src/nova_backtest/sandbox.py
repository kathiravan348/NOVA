"""Python strategies (D47): check the code, run it in a limited child process, return signals."""

import ast
import json
import os
import subprocess
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import NoReturn

from nova_contracts.indicators import BY_NAME, param_problems

from nova_backtest.bars import Bar
from nova_backtest.engine import EngineError
from nova_backtest.indicators import indicator

RUNNER = Path(__file__).with_name("sandbox_runner.py")
WALL_SECONDS = 30.0
FORBIDDEN_CALLS = {
    "eval", "exec", "compile", "open", "input", "getattr", "setattr", "delattr", "globals",
    "locals", "vars", "breakpoint", "help", "type", "super", "memoryview", "dir", "id",
}  # fmt: skip
FORBIDDEN_ATTRIBUTES = {"format", "format_map", "mro"}
ALLOWED_DUNDER_DEFS = {"__init__"}
# `ctx.sma` stays the child's own closes helper; other catalog names are computed here (D51).
CTX_INDICATORS = set(BY_NAME) - {"sma"}
CTX_METHODS = {"sma", "highest", "lowest"} | CTX_INDICATORS
MAX_AGO = 500


def canonical_key(name: str, params: Mapping[str, float]) -> str:
    """`rsi(period=14.0)`: all settings, defaults filled, catalog order (the child matches it)."""
    filled = BY_NAME[name].defaults() | dict(params)
    return (
        f"{name}("
        + ", ".join(f"{p.key}={float(filled[p.key])!r}" for p in BY_NAME[name].params)
        + ")"
    )


def _number(node: ast.expr) -> float | None:
    """An int or float literal (not a bool), else None."""
    if isinstance(node, ast.Constant) and isinstance(node.value, int | float):
        return None if isinstance(node.value, bool) else float(node.value)
    return None


class _Checker(ast.NodeVisitor):
    def __init__(self) -> None:
        # Canonical key → (indicator name, settings) of every `ctx.<indicator>(…)` call (D51).
        self.calls: dict[str, tuple[str, dict[str, float]]] = {}

    def refuse(self, node: ast.AST, why: str) -> NoReturn:
        raise EngineError(
            f"Python strategy not allowed: {why} (line {getattr(node, 'lineno', '?')})"
        )

    def visit_Import(self, node: ast.Import) -> None:
        self.refuse(node, "imports (use the preloaded math module)")

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        self.refuse(node, "imports (use the preloaded math module)")

    def visit_Global(self, node: ast.Global) -> None:
        self.refuse(node, "global")

    def visit_Nonlocal(self, node: ast.Nonlocal) -> None:
        self.refuse(node, "nonlocal")

    def visit_Name(self, node: ast.Name) -> None:
        if node.id.startswith("_"):
            self.refuse(node, f"names starting with _ ({node.id})")
        if node.id in FORBIDDEN_CALLS:
            self.refuse(node, f"{node.id}")

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr.startswith("_") or node.attr in FORBIDDEN_ATTRIBUTES:
            self.refuse(node, f"attribute {node.attr}")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        func = node.func
        if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name):
            if func.value.id == "ctx" and func.attr not in CTX_METHODS:
                self.refuse(node, f"ctx has no {func.attr}()")
            if func.value.id == "ctx" and func.attr in CTX_INDICATORS:
                self._indicator_call(node, func.attr)
        self.generic_visit(node)

    def _indicator_call(self, node: ast.Call, name: str) -> None:
        keys = [p.key for p in BY_NAME[name].params]
        what = f"ctx.{name}"
        if len(node.args) > len(keys):
            self.refuse(node, f"{what} takes at most {len(keys)} settings ({', '.join(keys)})")
        params: dict[str, float] = {}
        for key, arg in zip(keys, node.args, strict=False):
            value = _number(arg)
            if value is None:
                self.refuse(node, f"{what} settings must be plain numbers")
            params[key] = value
        for keyword in node.keywords:
            value = _number(keyword.value)
            if keyword.arg == "ago":
                if value is None or value != int(value) or not 0 <= value <= MAX_AGO:
                    self.refuse(node, f"{what} ago must be a whole number from 0 to {MAX_AGO}")
                continue
            if keyword.arg not in keys or keyword.arg in params:
                self.refuse(node, f"{what} has no setting {keyword.arg}")
            if value is None:
                self.refuse(node, f"{what} settings must be plain numbers")
            params[str(keyword.arg)] = value
        problems = param_problems(name, params)
        if problems:
            self.refuse(node, "; ".join(problems))
        self.calls[canonical_key(name, params)] = (name, params)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        if node.name.startswith("_") and node.name not in ALLOWED_DUNDER_DEFS:
            self.refuse(node, f"function names starting with _ ({node.name})")
        self.generic_visit(node)


def check_code(code: str) -> dict[str, tuple[str, dict[str, float]]]:
    """Refuses unsafe code; returns the `ctx.<indicator>(…)` calls by canonical key (D51)."""
    try:
        tree = ast.parse(code, filename="<strategy>")
    except SyntaxError as exc:
        raise EngineError(f"Python strategy has a syntax error (line {exc.lineno})") from exc
    checker = _Checker()
    checker.visit(tree)
    defines = any(isinstance(n, ast.ClassDef) and n.name == "Strategy" for n in tree.body)
    if not defines:
        raise EngineError("Python strategy must define a class named Strategy")
    return checker.calls


def _environment() -> dict[str, str]:
    """Nothing from the worker's environment reaches the child (no database URL, no tokens)."""
    if sys.platform == "win32" and "SYSTEMROOT" in os.environ:
        return {"SYSTEMROOT": os.environ["SYSTEMROOT"]}  # Windows Python cannot start without it
    return {}


def run_python(
    code: str, bars: Mapping[str, Sequence[Bar]], timeout: float = WALL_SECONDS
) -> dict[str, list[str | None]]:
    calls = check_code(code) or {}
    indicators = {
        symbol: {key: indicator(name, params, rows) for key, (name, params) in calls.items()}
        for symbol, rows in bars.items()
    }
    catalog = {
        name: [[p.key, p.default] for p in BY_NAME[name].params] for name in sorted(CTX_INDICATORS)
    }
    series = {
        symbol: [
            [b.ts.isoformat(), b.open / 100, b.high / 100, b.low / 100, b.close / 100, b.volume]
            for b in rows
        ]
        for symbol, rows in bars.items()
    }
    try:
        done = subprocess.run(  # noqa: S603 - fixed interpreter and script, JSON on stdin
            [sys.executable, "-I", str(RUNNER)],
            input=json.dumps(
                {"code": code, "series": series, "indicators": indicators, "catalog": catalog}
            ),
            capture_output=True,
            text=True,
            timeout=timeout,
            env=_environment(),
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise EngineError(f"Python strategy ran longer than {timeout:g} s") from exc
    lines = done.stdout.strip().splitlines()
    if not lines:
        raise EngineError("Python strategy stopped: it used too much time or memory")
    answer = json.loads(lines[-1])
    if "error" in answer:
        raise EngineError(f"Python strategy error: {answer['error']}")
    signals: dict[str, list[str | None]] = answer["signals"]
    if any(len(signals.get(s, [])) != len(rows) for s, rows in bars.items()):
        raise EngineError("Python strategy returned the wrong number of signals")
    return signals


class PythonSignals:
    def __init__(self, signals: Mapping[str, Sequence[str | None]]) -> None:
        self._signals = signals

    def enter(self, symbol: str, i: int) -> bool:
        return self._signals[symbol][i] == "enter"

    def exit(self, symbol: str, i: int) -> bool:
        return self._signals[symbol][i] == "exit"
