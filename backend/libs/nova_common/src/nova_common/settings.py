"""Service settings, read only from the environment (`NOVA_*`)."""

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

LogLevel = Literal["debug", "info", "warning", "error"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NOVA_", extra="forbid", frozen=True)

    database_url: SecretStr
    redis_url: SecretStr
    log_level: LogLevel = "info"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
