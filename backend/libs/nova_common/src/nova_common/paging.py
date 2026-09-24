"""Opaque keyset cursors for paged lists (D32): a cursor holds the sort key of the last row."""

import base64
import binascii
from collections.abc import Sequence

from nova_common.errors import ApiException

_SEPARATOR = "\x1f"


def encode_cursor(parts: Sequence[str]) -> str:
    raw = _SEPARATOR.join(parts).encode("utf-8")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def decode_cursor(cursor: str, size: int) -> list[str]:
    """The parts of a cursor made by `encode_cursor`; anything else is a 400 `invalid_request`."""
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        parts = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8").split(_SEPARATOR)
    except (binascii.Error, UnicodeError, ValueError):
        parts = []
    if len(parts) != size or not all(parts):
        raise ApiException(400, "invalid_request", "Unknown cursor")
    return parts
