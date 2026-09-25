"""Kite binary tick parsing (D49)."""

import struct
from datetime import UTC, datetime

from nova_broker.ticks import parse_ticks


def frame(*packets: bytes) -> bytes:
    body = b"".join(struct.pack(">h", len(p)) + p for p in packets)
    return struct.pack(">h", len(packets)) + body


def ltp(token: int, price: int) -> bytes:
    return struct.pack(">2i", token, price)


def quote(token: int, price: int, qty: int, volume: int) -> bytes:
    return struct.pack(">11i", token, price, qty, price, volume, 0, 0, 0, 0, 0, 0)


def full(token: int, price: int, qty: int, volume: int, oi: int, stamp: int) -> bytes:
    values = (token, price, qty, price, volume, 0, 0, 0, 0, 0, 0, stamp, oi, 0, 0, stamp)
    head = struct.pack(">16i", *values)
    return head + bytes(184 - len(head))


def test_ltp_quote_and_full_packets() -> None:
    message = frame(
        ltp(1, 150_025), quote(2, 99_900, 10, 5_000), full(3, 20_000, 5, 900, 77, 1_790_000_000)
    )
    ticks = parse_ticks(message)
    assert [(t.token, t.last_price_paise, t.last_qty, t.volume, t.oi) for t in ticks] == [
        (1, 150_025, 0, 0, None),
        (2, 99_900, 10, 5_000, None),
        (3, 20_000, 5, 900, 77),
    ]
    assert ticks[0].exchange_ts is None
    assert ticks[2].exchange_ts == datetime.fromtimestamp(1_790_000_000, UTC)


def test_heartbeat_and_empty_give_nothing() -> None:
    assert parse_ticks(b"\x00") == []
    assert parse_ticks(b"") == []


def test_unknown_lengths_and_zero_prices_are_skipped() -> None:
    index = struct.pack(">7i", 9, 1, 2, 3, 4, 5, 6)
    assert [t.token for t in parse_ticks(frame(index, ltp(4, 0), ltp(5, 10)))] == [5]


def test_truncated_frame_keeps_the_complete_packets() -> None:
    message = frame(ltp(1, 100), quote(2, 200, 1, 1))[:-5]
    assert [t.token for t in parse_ticks(message)] == [1]


def test_garbage_does_not_raise() -> None:
    assert parse_ticks(b"\x7f\xff\x00\x08abc") == []
