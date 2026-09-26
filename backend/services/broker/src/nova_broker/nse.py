"""NSE index member lists for Atlas (D56): the public constituent CSVs of niftyindices.com.

Only the broker service calls outside APIs (D35), so Atlas asks here instead of fetching them.
Not a Kite call: no rate-limiter slot.
"""

import csv
import io
import re
from dataclasses import asdict, dataclass
from typing import Annotated

import httpx2
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from nova_common import ApiException

from nova_broker.internal import require_service

router = APIRouter(prefix="/internal/nse")

TIMEOUT_SECONDS = 15.0
# niftyindices.com refuses clients that do not look like a browser.
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36"
FILE_PATTERN = re.compile(r"^ind_[a-z0-9_]+\.csv$")
COLUMNS = ("Company Name", "Industry", "Symbol", "Series")


class NseError(Exception):
    """The file could not be fetched or read; the message is safe to show in a data job."""


@dataclass(frozen=True)
class Constituent:
    symbol: str
    company: str
    industry: str


def nse_http(base_url: str, transport: httpx2.BaseTransport | None = None) -> httpx2.Client:
    return httpx2.Client(
        base_url=base_url.rstrip("/"),
        transport=transport,
        timeout=TIMEOUT_SECONDS,
        headers={"user-agent": USER_AGENT, "accept": "text/csv,*/*"},
        follow_redirects=True,
    )


def fetch_constituents(http: httpx2.Client, file: str) -> list[Constituent]:
    """Equity (`EQ` series) members of one index file, in file order."""
    if not FILE_PATTERN.match(file):
        raise ValueError("file must look like ind_nifty50list.csv")
    try:
        response = http.get(f"/{file}")
    except httpx2.HTTPError as exc:
        raise NseError(f"NSE did not answer for {file}") from exc
    if response.status_code != 200:
        raise NseError(f"NSE answered {response.status_code} for {file}")
    reader = csv.DictReader(io.StringIO(response.text.lstrip("﻿")))
    if reader.fieldnames is None or not set(COLUMNS) <= {f.strip() for f in reader.fieldnames}:
        raise NseError(f"{file} is not an NSE constituent list")
    members = [
        Constituent(
            symbol=row["Symbol"].strip(),
            company=row["Company Name"].strip(),
            industry=row["Industry"].strip(),
        )
        for row in ({k.strip(): (v or "") for k, v in raw.items() if k} for raw in reader)
        if row["Series"].strip() == "EQ" and row["Symbol"].strip()
    ]
    if not members:
        raise NseError(f"{file} lists no stocks")
    return members


@router.get("/constituents", dependencies=[Depends(require_service)])
def constituents(request: Request, file: Annotated[str, Query(max_length=80)]) -> JSONResponse:
    """`[{symbol, company, industry}]`; 400 bad file name, 502 NSE unavailable."""
    http: httpx2.Client = request.app.state.nse_http
    try:
        members = fetch_constituents(http, file)
    except ValueError as exc:
        raise ApiException(400, "invalid_request", str(exc)) from exc
    except NseError as exc:
        raise ApiException(502, "internal", str(exc)) from exc
    return JSONResponse([asdict(member) for member in members])
