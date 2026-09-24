"""A fake Kite Connect for tests (D35: tests never call Kite).

Use with `httpx2.MockTransport(fake.handle)`.
"""

import hashlib
from urllib.parse import parse_qs

import httpx2

API_KEY = "kitekeyAB12"
API_SECRET = "kite-secret"


class FakeKite:
    """Answers POST/DELETE /session/token like Kite; records every request."""

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
                "access_token": "kite-access-token-secret",
                "login_time": "2026-09-24 09:15:00",
            }
            return httpx2.Response(200, json={"status": "success", "data": data})
        if request.method == "DELETE":
            return httpx2.Response(200, json={"status": "success", "data": True})
        return httpx2.Response(404, json={"status": "error", "message": "Not found"})
