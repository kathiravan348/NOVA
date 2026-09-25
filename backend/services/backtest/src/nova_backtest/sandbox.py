"""Python strategies (D47): check the code, run it in a limited child process, return signals."""

import ast
import json
import os
import subprocess
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

from nova_backtest.bars import Bar
from nova_backtest.engine import EngineError

RUNNER = Path(__file__).with_name("sandbox_runner.py")
WALL_SECONDS = 30.0
FORBIDDEN_CALLS = {
    "eval", "exec", "compile", "open", "input", "getattr", "setattr", "delattr", "globals",
    "locals", "vars", "breakpoint", "help", "type", "super", "memoryview", "dir", "id",
}  # fmt: skip
FORBIDDEN_ATTRIBUTES = {"format", "format_map", "mro"}
ALLOWED_DUNDER_DEFS = {"__init__"}


class _Checker(ast.NodeVisitor):
    def refuse(self, node: ast.AST, why: str) -> None:
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

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        if node.name.startswith("_") and node.name not in ALLOWED_DUNDER_DEFS:
            self.refuse(node, f"function names starting with _ ({node.name})")
        self.generic_visit(node)


def check_code(code: str) -> None:
    try:
        tree = ast.parse(code, filename="<strategy>")
    except SyntaxError as exc:
        raise EngineError(f"Python strategy has a syntax error (line {exc.lineno})") from exc
    _Checker().visit(tree)
    defines = any(isinstance(n, ast.ClassDef) and n.name == "Strategy" for n in tree.body)
    if not defines:
        raise EngineError("Python strategy must define a class named Strategy")


def _environment() -> dict[str, str]:
    """Nothing from the worker's environment reaches the child (no database URL, no tokens)."""
    if sys.platform == "win32" and "SYSTEMROOT" in os.environ:
        return {"SYSTEMROOT": os.environ["SYSTEMROOT"]}  # Windows Python cannot start without it
    return {}


def run_python(
    code: str, bars: Mapping[str, Sequence[Bar]], timeout: float = WALL_SECONDS
) -> dict[str, list[str | None]]:
    check_code(code)
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
            input=json.dumps({"code": code, "series": series}),
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
