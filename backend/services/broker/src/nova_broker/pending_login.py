"""A Kite login waiting for the passphrase (D55): the request token lives in Redis for 2 minutes.

The token alone is useless (the exchange needs the sealed secret); it is used once and a few
wrong passphrases drop it.
"""

from redis import Redis

TTL_SECONDS = 120
MAX_WRONG_TRIES = 5


def _token_key(account_id: str) -> str:
    return f"broker:pending_login:{account_id}"


def _tries_key(account_id: str) -> str:
    return f"broker:pending_login_tries:{account_id}"


def keep(redis: Redis, account_id: str, request_token: str) -> None:
    pipe = redis.pipeline()
    pipe.set(_token_key(account_id), request_token, ex=TTL_SECONDS)
    pipe.delete(_tries_key(account_id))
    pipe.execute()


def get(redis: Redis, account_id: str) -> str | None:
    value = redis.get(_token_key(account_id))
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return value if isinstance(value, str) else None


def wrong_try(redis: Redis, account_id: str) -> bool:
    """Counts a wrong passphrase; True (and the login is dropped) on the last allowed try."""
    tries = int(redis.incr(_tries_key(account_id)))
    redis.expire(_tries_key(account_id), TTL_SECONDS)
    if tries >= MAX_WRONG_TRIES:
        drop(redis, account_id)
        return True
    return False


def drop(redis: Redis, account_id: str) -> None:
    redis.delete(_token_key(account_id), _tries_key(account_id))
