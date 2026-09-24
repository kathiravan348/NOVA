"""Kite Connect v3 rate limits (PLAN R3, checked 2026-09-23); NOVA default safety limits (D40)."""

from nova_db.models import RateLimitRule
from sqlalchemy import select
from sqlalchemy.orm import Session

ENDPOINTS = ("quote", "historical", "orders", "other")
WINDOWS = ("second", "minute", "day")
WINDOW_MS = {"second": 1_000, "minute": 60_000}

# Endpoint → window → broker limit. Set by Zerodha; NOVA cannot raise them.
KITE_LIMITS: dict[str, dict[str, int]] = {
    "quote": {"second": 1},
    "historical": {"second": 3},
    "orders": {"second": 10, "minute": 400, "day": 5_000},
    "other": {"second": 10},
}


def default_nova_limit(broker_limit: int) -> int:
    """90% of the broker limit, at least 1: headroom for other tools on the same API key."""
    return max(1, broker_limit * 9 // 10)


def ensure_rules(db: Session, account_id: str) -> None:
    """Adds the default rules an account is missing (new accounts, or limits added later)."""
    existing = {
        (rule.endpoint, rule.rate_window)
        for rule in db.scalars(select(RateLimitRule).where(RateLimitRule.account_id == account_id))
    }
    for endpoint, windows in KITE_LIMITS.items():
        for window, broker_limit in windows.items():
            if (endpoint, window) not in existing:
                db.add(
                    RateLimitRule(
                        account_id=account_id,
                        endpoint=endpoint,
                        rate_window=window,
                        broker_limit=broker_limit,
                        nova_limit=default_nova_limit(broker_limit),
                    )
                )
