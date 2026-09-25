"""Kite WebSocket binary ticks (D11, D49).

A message is a big-endian int16 packet count, then per packet an int16 length and the packet.
Equity packets: `ltp` 8 bytes, `quote` 44 bytes, `full` 184 bytes (adds timestamps, open interest
and depth). Prices are paise. A 1-byte message is a heartbeat. Index packets (28/32 bytes) and
anything else are skipped.
"""

import struct
from dataclasses import dataclass
from datetime import UTC, datetime

LTP, QUOTE, FULL = 8, 44, 184


@dataclass(frozen=True)
class ParsedTick:
    token: int
    last_price_paise: int
    last_qty: int
    volume: int
    oi: int | None
    exchange_ts: datetime | None


def _ints(packet: bytes, count: int) -> tuple[int, ...]:
    return struct.unpack(f">{count}i", packet[: count * 4])


def _parse(packet: bytes) -> ParsedTick | None:
    if len(packet) == LTP:
        token, ltp = _ints(packet, 2)
        return ParsedTick(token, ltp, 0, 0, None, None)
    if len(packet) not in (QUOTE, FULL):
        return None
    token, ltp, qty, _avg, volume = _ints(packet, 5)
    if len(packet) == QUOTE:
        return ParsedTick(token, ltp, qty, volume, None, None)
    values = _ints(packet, 16)
    oi, stamp = values[12], values[15]
    exchange_ts = datetime.fromtimestamp(stamp, UTC) if stamp > 0 else None
    return ParsedTick(token, ltp, qty, volume, oi, exchange_ts)


def parse_ticks(message: bytes) -> list[ParsedTick]:
    """Every equity tick in one binary message; heartbeats and broken frames give none."""
    if len(message) < 2:
        return []
    (count,) = struct.unpack(">h", message[:2])
    ticks, offset = [], 2
    for _ in range(count):
        if offset + 2 > len(message):
            break
        (length,) = struct.unpack(">h", message[offset : offset + 2])
        packet = message[offset + 2 : offset + 2 + length]
        offset += 2 + length
        if len(packet) != length:
            break
        tick = _parse(packet)
        if tick is not None and tick.last_price_paise > 0:
            ticks.append(tick)
    return ticks
