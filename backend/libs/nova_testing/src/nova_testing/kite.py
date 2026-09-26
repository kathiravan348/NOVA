"""A fake Kite Connect for tests (D35: tests never call Kite).

Use with `httpx2.MockTransport(fake.handle)`.
"""

import hashlib
from datetime import date, datetime, timedelta
from urllib.parse import parse_qs

import httpx2

API_KEY = "kitekeyAB12"
API_SECRET = "kite-secret"
# Seals API_SECRET in test accounts' Kite apps (D55).
PASSPHRASE = "correct horse battery"
ACCESS_TOKEN = "kite-access-token-secret"

_HEADER = (
    "instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,"
    "lot_size,instrument_type,segment,exchange"
)
_NSE_ROWS = [
    '408065,1594,INFY,"INFOSYS",0,,0,0.05,1,EQ,NSE,NSE',
    '2953217,11536,TCS,"TATA CONSULTANCY SERV LT",0,,0,0.05,1,EQ,NSE,NSE',
    '738561,2885,RELIANCE,"RELIANCE INDUSTRIES",0,,0,0.05,1,EQ,NSE,NSE',
    '256265,1001,NIFTY 50,"NIFTY 50",0,,0,0,0,EQ,INDICES,NSE',
]
_NFO_ROWS = [
    '11111,1,INFY26OCTFUT,"INFY",0,2026-10-27,0,0.1,400,FUT,NFO-FUT,NFO',
    '22222,2,INFY26SEPFUT,"INFY",0,2026-09-29,0,0.1,300,FUT,NFO-FUT,NFO',
    '33333,3,INFY26SEP1500CE,"INFY",0,2026-09-29,1500,0.05,300,CE,NFO-OPT,NFO',
    '44444,4,RELIANCE26SEPFUT,"RELIANCE",0,2026-09-29,0,0.1,250,FUT,NFO-FUT,NFO',
]
INSTRUMENTS_CSV = {
    "NSE": "\n".join([_HEADER, *_NSE_ROWS]) + "\n",
    "NFO": "\n".join([_HEADER, *_NFO_ROWS]) + "\n",
}


def fake_candles(start: date, end: date, interval: str) -> list[list[object]]:
    """One bar per weekday from `start` to `end`: daily bars at 00:00 IST, intraday at 09:15 IST."""
    bars: list[list[object]] = []
    day = start
    while day <= end:
        if day.weekday() < 5:
            clock = "00:00:00" if interval == "day" else "09:15:00"
            close = 1500 + day.toordinal() % 50 + 0.35
            stamp = f"{day.isoformat()}T{clock}+0530"
            bars.append([stamp, close - 1, close + 2, close - 3, close, 1000])
        day += timedelta(days=1)
    return bars


class FakeKite:
    """Answers the session, instrument and historical endpoints like Kite; records every request."""

    def __init__(self) -> None:
        self.requests: list[httpx2.Request] = []
        self.user_id = "AB1234"
        self.error: str | None = None

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        if self.error:
            return httpx2.Response(403, json={"status": "error", "message": self.error})
        if request.method == "POST" and request.url.path == "/session/token":
            form = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
            raw = API_KEY + form["request_token"] + API_SECRET
            if form["checksum"] != hashlib.sha256(raw.encode()).hexdigest():
                return httpx2.Response(403, json={"status": "error", "message": "Invalid checksum"})
            data = {
                "user_id": self.user_id,
                "access_token": ACCESS_TOKEN,
                "login_time": "2026-09-24 09:15:00",
            }
            return httpx2.Response(200, json={"status": "success", "data": data})
        if request.method == "DELETE":
            return httpx2.Response(200, json={"status": "success", "data": True})
        if request.headers.get("authorization") != f"token {API_KEY}:{ACCESS_TOKEN}":
            return httpx2.Response(403, json={"status": "error", "message": "Invalid token"})
        parts = request.url.path.strip("/").split("/")
        if parts[:1] == ["instruments"] and len(parts) == 2:
            return httpx2.Response(200, text=INSTRUMENTS_CSV.get(parts[1], ""))
        if parts[:2] == ["instruments", "historical"] and len(parts) == 4:
            start = datetime.strptime(request.url.params["from"], "%Y-%m-%d %H:%M:%S").date()
            end = datetime.strptime(request.url.params["to"], "%Y-%m-%d %H:%M:%S").date()
            history = {"candles": fake_candles(start, end, parts[3])}
            return httpx2.Response(200, json={"status": "success", "data": history})
        return httpx2.Response(404, json={"status": "error", "message": "Not found"})
