"""Row ids: `<prefix>_<12 hex ms timestamp><10 hex random>`, so ids sort by creation time (D37)."""

import re
import secrets
import time

_PREFIX = re.compile(r"^[a-z]{2,8}$")


def new_id(prefix: str) -> str:
    if not _PREFIX.fullmatch(prefix):
        raise ValueError(f"id prefix must be 2-8 lowercase letters, got {prefix!r}")
    millis = time.time_ns() // 1_000_000
    return f"{prefix}_{millis:012x}{secrets.token_hex(5)}"
