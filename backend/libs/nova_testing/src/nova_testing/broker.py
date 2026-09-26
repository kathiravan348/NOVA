"""A fake broker service for other services' tests (D41): its `/internal/kite/*` endpoints.

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

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        if request.headers.get("x-nova-internal-token") != self.internal_token:
            return httpx2.Response(401, json={"error": {"code": "unauthorized", "message": "no"}})
        if self.error:
            body = {"error": {"code": "invalid_request", "message": self.error}}
            return httpx2.Response(self.error_status, json=body)
        path = request.url.path
        if path.startswith("/internal/kite/instruments/"):
            return httpx2.Response(200, text=INSTRUMENTS_CSV.get(path.rsplit("/", 1)[1], ""))
        if path == "/internal/kite/historical":
            self.history_calls.append(request)
            start = datetime.fromisoformat(request.url.params["start"]).date()
            end = datetime.fromisoformat(request.url.params["end"]).date()
            candles = fake_candles(start, end, request.url.params["interval"])
            return httpx2.Response(200, json={"candles": candles})
        return httpx2.Response(404, json={"error": {"code": "not_found", "message": path}})
