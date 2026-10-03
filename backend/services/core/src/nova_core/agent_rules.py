"""D67: explicit agent permissions, with every new gateway prefix blocked by default."""

from typing import Literal

Rule = Literal["free", "held", "blocked"]
PREFIX_RULES: dict[str, Rule] = {
    "broker": "blocked",
    "live": "blocked",
    "strategies": "held",
    "backtests": "held",
    "research-profiles": "held",
    "market-data": "held",
    "data-jobs": "held",
}
FREE_READS = {"/me", "/audit", "/approvals", "/ws"}
FREE_AUTH = {"/auth/login", "/auth/logout"}
WRITES = {"POST", "PUT", "PATCH", "DELETE"}


def classify(method: str, path: str) -> Rule:
    # A decoded dot segment must never be normalized into a different upstream prefix.
    if (
        not path.startswith("/")
        or "\\" in path
        or "%" in path
        or any(part in {".", ".."} for part in path.split("/"))
    ):
        return "blocked"
    if (method == "GET" and path in FREE_READS) or (method == "POST" and path in FREE_AUTH):
        return "free"
    prefix = path.removeprefix("/").split("/", 1)[0]
    if PREFIX_RULES.get(prefix, "blocked") == "blocked":
        return "blocked"
    if method == "GET" or (method == "POST" and path == "/data-jobs/plan"):
        return "free"
    return "held" if method in WRITES else "blocked"
