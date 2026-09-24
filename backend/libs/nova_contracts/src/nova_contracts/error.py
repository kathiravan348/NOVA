"""ApiError: mirrors `frontend/packages/contracts/src/error.ts`."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ApiErrorCode = Literal["not_found", "invalid_request", "internal"]


class ApiErrorBody(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    code: ApiErrorCode
    message: str = Field(min_length=1)


class ApiError(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    error: ApiErrorBody
