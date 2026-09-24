"""User: mirrors `frontend/packages/contracts/src/user.ts`."""

from typing import Annotated, Literal

from pydantic import Field

from nova_contracts.common import Contract, Id, UtcDateTime

UserRole = Literal["super_admin"]


class User(Contract):
    id: Id
    name: Annotated[str, Field(min_length=1)]
    email: Annotated[str, Field(pattern=r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")]
    role: UserRole
    created_at: UtcDateTime
    last_login_at: UtcDateTime | None
