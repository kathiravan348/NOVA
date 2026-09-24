"""`GET /broker/rate-limits` and `PATCH /broker/rate-limits/{accountId}/{endpoint}` (D27, D40)."""

from collections import defaultdict
from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from nova_common import ApiException
from nova_contracts import RateLimit, RateLimitUpdate
from nova_db.audit import record_audit
from nova_db.models import BrokerAccount
from nova_db.models import RateLimitRule as RuleRow
from nova_db.web import Db
from sqlalchemy import select

from nova_broker.deps import CallerDep
from nova_broker.limiter import RateLimiter
from nova_broker.limits import ENDPOINTS, WINDOWS

router = APIRouter(prefix="/broker")

WINDOW_WORDS = {"second": "per second", "minute": "per minute", "day": "per day"}


def _limiter(request: Request) -> RateLimiter:
    limiter: RateLimiter = request.app.state.limiter
    return limiter


@router.get("/rate-limits")
def list_rate_limits(request: Request, caller: CallerDep, db: Db) -> JSONResponse:
    limiter, now = _limiter(request), datetime.now(UTC)
    _, next_reset = limiter.period(now)
    rows = db.execute(
        select(RuleRow)
        .join(BrokerAccount, BrokerAccount.id == RuleRow.account_id)
        .order_by(BrokerAccount.created_at, BrokerAccount.id)
    ).scalars()
    grouped: dict[tuple[str, str], list[RuleRow]] = defaultdict(list)
    for row in rows:
        grouped[(row.account_id, row.endpoint)].append(row)

    accounts = list(dict.fromkeys(account for account, _ in grouped))
    body = []
    for account in accounts:
        for endpoint in ENDPOINTS:
            rules = sorted(
                grouped.get((account, endpoint), []), key=lambda r: WINDOWS.index(r.rate_window)
            )
            if not rules:
                continue
            usage = limiter.usage(account, endpoint, [r.rate_window for r in rules], now)
            limit = RateLimit.model_validate(
                {
                    "account_id": account,
                    "endpoint": endpoint,
                    "rules": [
                        {
                            "window": r.rate_window,
                            "broker_limit": r.broker_limit,
                            "nova_limit": r.nova_limit,
                            "used": min(usage.used[r.rate_window], r.broker_limit),
                            "resets_at": next_reset if r.rate_window == "day" else None,
                        }
                        for r in rules
                    ],
                    "throttled_today": usage.throttled_today,
                    "updated_at": max(r.updated_at for r in rules),
                }
            )
            body.append(limit.model_dump(mode="json"))
    return JSONResponse(body)


@router.patch("/rate-limits/{account_id}/{endpoint}", status_code=204)
def update_rate_limit(
    account_id: str, endpoint: str, update: RateLimitUpdate, caller: CallerDep, db: Db
) -> Response:
    rules = db.scalars(
        select(RuleRow).where(RuleRow.account_id == account_id, RuleRow.endpoint == endpoint)
    ).all()
    if not rules:
        raise ApiException(404, "not_found", f"Rate limit {account_id}/{endpoint} not found")
    rule = next((r for r in rules if r.rate_window == update.window), None)
    if rule is None:
        raise ApiException(400, "invalid_request", f"No {update.window} window for {endpoint}")
    if update.nova_limit > rule.broker_limit:
        raise ApiException(
            400,
            "invalid_request",
            f"Own limit must be at most the broker limit ({rule.broker_limit:,})",
        )
    before, rule.nova_limit = rule.nova_limit, update.nova_limit
    rule.updated_at = datetime.now(UTC)
    record_audit(
        db,
        action="broker.rate_limit_update",
        actor_id=caller.id,
        actor_name=caller.name,
        summary=f"{endpoint} {WINDOW_WORDS[update.window]}: {before:,} → {update.nova_limit:,}",
        target_type="broker_account",
        target_id=account_id,
        ip=caller.ip,
    )
    db.commit()
    return Response(status_code=204)
