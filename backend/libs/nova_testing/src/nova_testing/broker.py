"""A fake broker service for other services' tests (D41, D56): its `/internal/*` endpoints.

Answers from `nova_testing.kite` data. Use with `httpx2.MockTransport(fake.handle)`.
"""

from datetime import datetime

import httpx2

from nova_testing.kite import INSTRUMENTS_CSV, fake_candles


class FakeBroker:
    def __init__(self, internal_token: str) -> None:
        self.internal_token = internal_token
        self.history_calls: list[httpx2.Request] = []
        self.error: str | None = None
        self.error_status = 400
        self.logged_in = True
        # NSE constituent files (D56): file → members; a file not listed here answers 502.
        self.constituents: dict[str, list[dict[str, str]]] = {
            "ind_nifty50list.csv": [
                _member("INFY", "Infosys Ltd.", "Information Technology"),
                _member("TCS", "Tata Consultancy Services Ltd.", "Information Technology"),
                _member("RELIANCE", "Reliance Industries Ltd.", "Oil Gas & Consumable Fuels"),
            ],
            "ind_niftyitlist.csv": [
                _member("INFY", "Infosys Ltd.", "Information Technology"),
                _member("TCS", "Tata Consultancy Services Ltd.", "Information Technology"),
            ],
        }
        self.nse_files: list[str] = []

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        if request.headers.get("x-nova-internal-token") != self.internal_token:
            return httpx2.Response(401, json={"error": {"code": "unauthorized", "message": "no"}})
        if self.error:
            body = {"error": {"code": "invalid_request", "message": self.error}}
            return httpx2.Response(self.error_status, json=body)
        path = request.url.path
        if path == "/internal/kite/session":
            return httpx2.Response(200, json={"loggedIn": self.logged_in, "accountId": None})
        if path == "/internal/nse/constituents":
            file = request.url.params["file"]
            self.nse_files.append(file)
            if file not in self.constituents:
                message = f"NSE answered 404 for {file}"
                return httpx2.Response(
                    502, json={"error": {"code": "internal", "message": message}}
                )
            return httpx2.Response(200, json=self.constituents[file])
        if path.startswith("/internal/kite/instruments/"):
            return httpx2.Response(200, text=INSTRUMENTS_CSV.get(path.rsplit("/", 1)[1], ""))
        if path == "/internal/kite/historical":
            self.history_calls.append(request)
            start = datetime.fromisoformat(request.url.params["start"]).date()
            end = datetime.fromisoformat(request.url.params["end"]).date()
            candles = fake_candles(start, end, request.url.params["interval"])
            return httpx2.Response(200, json={"candles": candles})
        return httpx2.Response(404, json={"error": {"code": "not_found", "message": path}})


def _member(symbol: str, company: str, industry: str) -> dict[str, str]:
    return {"symbol": symbol, "company": company, "industry": industry}
