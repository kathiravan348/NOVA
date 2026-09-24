import pytest
from nova_core.passwords import hash_password, verify_password


def test_hash_verifies_only_the_same_password() -> None:
    stored = hash_password("correct horse battery")

    assert stored.startswith("scrypt$32768$8$1$")
    assert verify_password("correct horse battery", stored)
    assert not verify_password("correct horse batterY", stored)


def test_same_password_gets_a_different_salt() -> None:
    assert hash_password("same password!") != hash_password("same password!")


@pytest.mark.parametrize("stored", ["", "plain", "bcrypt$1$2$3$4$5", "scrypt$x$8$1$AA==$AA=="])
def test_malformed_hash_never_verifies(stored: str) -> None:
    assert not verify_password("anything", stored)
