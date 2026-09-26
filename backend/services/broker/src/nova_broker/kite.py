"""Kite Connect v3 client (D35, D39, D41): session, instruments, historical candles. No orders."""

import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

import httpx2

API_BASE = "https://api.kite.trade"
LOGIN_BASE = "https://kite.zerodha.com/connect/login"
IST = ZoneInfo("Asia/Kolkata")
TIMEOUT_SECONDS = 15.0


# Kite historical intervals (D41). Atlas maps NOVA timeframes onto these.
INTERVALS = ("minute", "3minute", "5minute", "15minute", "30minute", "60minute", "day")


class KiteError(Exception):
    """Kite answered with an error, or could not be reached."""


@dataclass(frozen=True)
class KiteSession:
    user_id: str
    access_token: str
    login_time: datetime


def kite_http(transport: httpx2.BaseTransport | None = None) -> httpx2.Client:
    """One connection pool for every account's calls; `transport` replaces the network in tests."""
    return httpx2.Client(
        base_url=API_BASE,
        transport=transport,
        timeout=TIMEOUT_SECONDS,
        headers={"X-Kite-Version": "3"},
    )


class KiteClient:
    """Kite calls with one account's API key (D55). The secret is passed only to `exchange`."""

    def __init__(self, api_key: str, http: httpx2.Client) -> None:
        self._api_key = api_key
        self._http = http

    def login_url(self, state: str) -> str:
        """Kite sends `state` back to the callback through `redirect_params`."""
        query = urlencode(
            {"v": "3", "api_key": self._api_key, "redirect_params": urlencode({"state": state})}
        )
        return f"{LOGIN_BASE}?{query}"

    def exchange(self, request_token: str, api_secret: str) -> KiteSession:
        """Turns the one-time `request_token` from the login redirect into an access token."""
        raw = self._api_key + request_token + api_secret
        checksum = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        data = self._call(
            "POST",
            "/session/token",
            data={"api_key": self._api_key, "request_token": request_token, "checksum": checksum},
        )
        try:
            login_time = datetime.strptime(str(data["login_time"]), "%Y-%m-%d %H:%M:%S")
            return KiteSession(
                user_id=str(data["user_id"]),
                access_token=str(data["access_token"]),
                login_time=login_time.replace(tzinfo=IST),
            )
        except (KeyError, ValueError) as exc:
            raise KiteError("Unexpected session response from Kite") from exc

    def invalidate(self, access_token: str) -> None:
        self._call(
            "DELETE",
            "/session/token",
            params={"api_key": self._api_key, "access_token": access_token},
        )

    def instruments(self, exchange: str, access_token: str) -> str:
        """The instrument dump for one exchange (CSV, a few MB)."""
        try:
            response = self._http.get(f"/instruments/{exchange}", headers=self._auth(access_token))
        except httpx2.HTTPError as exc:
            raise KiteError("Kite could not be reached") from exc
        if response.status_code >= 400:
            raise KiteError(f"Kite answered {response.status_code} for the instrument list")
        return response.text

    def historical(
        self,
        instrument_token: int,
        interval: str,
        start: datetime,
        end: datetime,
        access_token: str,
    ) -> list[list[Any]]:
        """Candles `[time, open, high, low, close, volume]`; Kite sends times with +0530.

        Any: Kite rows mix strings and numbers.
        """
        stamp = "%Y-%m-%d %H:%M:%S"
        data = self._call(
            "GET",
            f"/instruments/historical/{instrument_token}/{interval}",
            params={
                "from": start.astimezone(IST).strftime(stamp),
                "to": end.astimezone(IST).strftime(stamp),
            },
            headers=self._auth(access_token),
        )
        candles = data.get("candles")
        if not isinstance(candles, list):
            raise KiteError("Unexpected historical response from Kite")
        return candles

    def _auth(self, access_token: str) -> dict[str, str]:
        return {"Authorization": f"token {self._api_key}:{access_token}"}

    def _call(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        """Any: request options and Kite's `data` object are loosely typed JSON."""
        try:
            response = self._http.request(method, path, **kwargs)
            body = response.json()
        except (httpx2.HTTPError, ValueError) as exc:
            raise KiteError("Kite could not be reached") from exc
        if response.status_code >= 400 or body.get("status") != "success":
            raise KiteError(str(body.get("message") or f"Kite answered {response.status_code}"))
        data = body.get("data")
        return data if isinstance(data, dict) else {}
