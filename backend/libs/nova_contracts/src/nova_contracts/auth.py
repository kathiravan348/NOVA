"""LoginRequest: mirrors `frontend/packages/contracts/src/auth.ts` (D38)."""

from typing import Annotated

from pydantic import Field

from nova_contracts.common import Contract, Email


class LoginRequest(Contract):
    email: Email
    password: Annotated[str, Field(min_length=1, max_length=200)]
