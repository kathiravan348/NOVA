"""The strategy library (D62, D73): 100 fixed research strategies shipped as JSON.

The files are transcribed from `docs/STRATEGY-LIBRARY.md`. They are loaded and checked once;
the service refuses to start if any entry is invalid, so a bad edit never reaches the screen.
"""

from functools import lru_cache
from importlib.resources import files

from nova_contracts import LibraryEntry, LibraryFamily, StrategyLibrary
from nova_contracts.strategy import spec_param_problems
from pydantic import TypeAdapter

ENTRY_FILES = (
    "a_rotation.json",
    "b_trend.json",
    "c_pullback.json",
    "d_patterns.json",
    "ef_hold_baseline.json",
    "g_intraday.json",
)
ENTRIES = TypeAdapter[list[LibraryEntry]](list[LibraryEntry])
FAMILIES = TypeAdapter[list[LibraryFamily]](list[LibraryFamily])


def _read(name: str) -> str:
    return (files("nova_strategy") / "library" / name).read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def load_library() -> StrategyLibrary:
    """Every family and entry, validated; raises `ValueError` naming the first problem."""
    families = FAMILIES.validate_json(_read("families.json"))
    entries = [entry for name in ENTRY_FILES for entry in ENTRIES.validate_json(_read(name))]
    known = {family.id for family in families}
    seen: set[str] = set()
    for entry in entries:
        problems = spec_param_problems(entry.spec)
        if problems:
            raise ValueError(f"Library entry {entry.id}: {'; '.join(problems)}")
        if entry.id in seen:
            raise ValueError(f"Library entry {entry.id} appears twice")
        if entry.family not in known:
            raise ValueError(f"Library entry {entry.id} has an unknown family {entry.family}")
        seen.add(entry.id)
    return StrategyLibrary(families=families, entries=entries)
