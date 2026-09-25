"""Child process that runs one Python strategy (D47). Standard library only.

Started as `python -I sandbox_runner.py` with an empty environment. Reads one JSON request on stdin:
`{"code": str, "series": {symbol: [[time, open, high, low, close, volume], ...]}}` (rupees),
`"indicators": {symbol: {key: [value | null, ...]}}` (one value per bar, computed by the parent for
every `ctx.<indicator>(…)` call it found, D51) and `"catalog": {name: [[key, default], ...]}`;
writes one JSON line: `{"signals": {symbol: ["enter" | "exit" | null, ...]}}` or `{"error": str}`.
The code was already checked by `sandbox.check_code`; this process adds limits and safe builtins.
"""

import builtins
import json
import math
import sys
import traceback
from collections.abc import Iterator
from typing import Any

CPU_SECONDS = 20
MEMORY_BYTES = 512 * 1024 * 1024
OPEN_FILES = 16

SAFE_NAMES = (
    "abs", "all", "any", "bool", "dict", "divmod", "enumerate", "filter", "float", "int",
    "isinstance", "len", "list", "map", "max", "min", "pow", "range", "reversed", "round", "set",
    "sorted", "str",
    "sum", "tuple", "zip", "None", "True", "False", "ValueError", "ZeroDivisionError", "Exception",
)  # fmt: skip
SAFE_BUILTINS = {name: getattr(builtins, name) for name in SAFE_NAMES}
SAFE_BUILTINS["__build_class__"] = builtins.__build_class__  # needed to define `class Strategy`


def limit_resources() -> None:
    if sys.platform == "win32":
        return  # limits apply in the Linux worker container; Windows test runs skip them
    import resource

    resource.setrlimit(resource.RLIMIT_CPU, (CPU_SECONDS, CPU_SECONDS))
    resource.setrlimit(resource.RLIMIT_AS, (MEMORY_BYTES, MEMORY_BYTES))
    resource.setrlimit(resource.RLIMIT_NOFILE, (OPEN_FILES, OPEN_FILES))


class Closes:
    """Read-only closes up to the current bar (indexing, slicing, len, iteration)."""

    def __init__(self, values: list[float], end: int) -> None:
        self._values, self._end = values, end

    def __len__(self) -> int:
        return self._end

    def __getitem__(self, key: int | slice) -> Any:  # Any: a float for an index, a list for a slice
        return self._values[: self._end][key]

    def __iter__(self) -> Iterator[float]:
        return iter(self._values[: self._end])


# Any: JSON values from the parent (settings are numbers, series are floats or None).
Catalog = dict[str, list[list[Any]]]
Indicators = dict[str, list[Any]]


def indicator_key(
    catalog: Catalog, name: str, args: tuple[Any, ...], kwargs: dict[str, Any]
) -> str:
    """Same text as `sandbox.canonical_key`: every setting in catalog order, defaults filled."""
    settings = {key: default for key, default in catalog[name]}
    settings.update(zip([key for key, _ in catalog[name]], args, strict=False))
    settings.update(kwargs)
    return (
        f"{name}(" + ", ".join(f"{key}={float(settings[key])!r}" for key, _ in catalog[name]) + ")"
    )


class Context:
    def __init__(
        self,
        symbol: str,
        index: int,
        bar: list[Any],
        closes: Closes,
        catalog: Catalog | None = None,
        indicators: Indicators | None = None,
    ) -> None:
        # Any: a bar row is [time, open, high, low, close, volume] from JSON.
        self.symbol, self.index = symbol, index
        self.time, self.open, self.high, self.low, self.close, self.volume = bar
        self.closes = closes
        self._catalog = catalog or {}
        self._indicators = indicators or {}

    def __getattr__(self, name: str) -> Any:  # Any: a function returning a float or None
        """`ctx.rsi(14)`, `ctx.macd_signal(12, 26, 9, ago=1)`: values the parent computed."""
        if name.startswith("_") or name not in self._catalog:
            raise AttributeError(f"ctx has no {name}")

        def value(*args: Any, ago: int = 0, **kwargs: Any) -> float | None:
            series = self._indicators.get(indicator_key(self._catalog, name, args, kwargs))
            if series is None:
                raise ValueError(f"write ctx.{name}(…) with plain numbers as its settings")
            at = self.index - ago
            return series[at] if at >= 0 else None

        return value

    def _window(self, n: int) -> list[float] | None:
        if not isinstance(n, int) or n < 1:
            raise ValueError("period must be a whole number of at least 1")
        return None if len(self.closes) < n else self.closes[-n:]

    def sma(self, n: int) -> float | None:
        window = self._window(n)
        return None if window is None else sum(window) / n

    def highest(self, n: int) -> float | None:
        window = self._window(n)
        return None if window is None else max(window)

    def lowest(self, n: int) -> float | None:
        window = self._window(n)
        return None if window is None else min(window)


def _line(exc: BaseException) -> str:
    frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename == "<strategy>"]
    return f" (line {frames[-1].lineno})" if frames else ""


def main() -> None:
    request = json.loads(sys.stdin.read())
    limit_resources()
    # Any: whatever the user's code defines.
    namespace: dict[str, Any] = {
        "__builtins__": SAFE_BUILTINS,
        "__name__": "strategy",
        "math": math,
    }
    try:
        exec(compile(request["code"], "<strategy>", "exec"), namespace)
        strategy_class = namespace.get("Strategy")
        if strategy_class is None:
            raise ValueError("define a class named Strategy")
        signals: dict[str, list[str | None]] = {}
        catalog: Catalog = request.get("catalog", {})
        for symbol, bars in request["series"].items():
            instance = strategy_class()
            closes = [bar[4] for bar in bars]
            indicators: Indicators = request.get("indicators", {}).get(symbol, {})
            out: list[str | None] = []
            for i, bar in enumerate(bars):
                ctx = Context(symbol, i, bar, Closes(closes, i + 1), catalog, indicators)
                result = instance.on_bar(ctx)
                if result not in ("enter", "exit", None):
                    raise ValueError(f'on_bar must return "enter", "exit" or None, not {result!r}')
                out.append(result)
            signals[symbol] = out
        print(json.dumps({"signals": signals}))
    except Exception as exc:  # the user's error, reported back with its line
        print(json.dumps({"error": f"{type(exc).__name__}: {exc}{_line(exc)}"}))


if __name__ == "__main__":
    main()
