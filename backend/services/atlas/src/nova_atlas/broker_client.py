"""Kite data through the broker's internal endpoints (D35, D41). Atlas never calls Kite itself."""

from datetime import datetime
from typing import Any

import httpx2

TIMEOUT_SECONDS = 60.0


class BrokerDataError(Exception):
    """The broker refused or failed the request; the message is safe to show in a data job."""


class BrokerData:
    def __init__(
        self, base_url: str, internal_token: str, transport: httpx2.BaseTransport | None = None
    ) -> None:
        self._http = httpx2.Client(
            base_url=base_url.rstrip("/"),
            transport=transport,
            timeout=TIMEOUT_SECONDS,
            headers={"x-nova-internal-token": internal_token},
        )

    def close(self) -> None:
        self._http.close()

    def instruments(self, exchange: str) -> str:
        return self._get(f"/internal/kite/instruments/{exchange}").text

    def historical(
        self, instrument_token: int, interval: str, start: datetime, end: datetime
    ) -> list[list[Any]]:
        """Kite rows `[time, open, high, low, close, volume]`. Any: rows mix text and numbers."""
        response = self._get(
            "/internal/kite/historical",
            params={
                "instrument_token": instrument_token,
                "interval": interval,
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
        )
        candles = response.json().get("candles")
        if not isinstance(candles, list):
            raise BrokerDataError("Unexpected historical response from the broker")
        return candles

    def _get(self, path: str, params: dict[str, str | int] | None = None) -> httpx2.Response:
        try:
            response = self._http.get(path, params=params)
        except httpx2.HTTPError as exc:
            raise BrokerDataError("The broker service did not answer") from exc
        if response.status_code >= 400:
            try:
                message = str(response.json()["error"]["message"])
            except (ValueError, KeyError, TypeError):
                message = f"The broker answered {response.status_code}"
            raise BrokerDataError(message)
        return response
