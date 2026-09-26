import pytest
from nova_broker.vault import WrongPassphrase, seal, unseal

PASSPHRASE = "correct horse battery"


def test_round_trip() -> None:
    blob = seal("kite-secret", PASSPHRASE, "brk_1")

    assert unseal(blob, PASSPHRASE, "brk_1") == "kite-secret"
    assert b"kite-secret" not in blob


def test_two_seals_differ() -> None:
    assert seal("kite-secret", PASSPHRASE, "brk_1") != seal("kite-secret", PASSPHRASE, "brk_1")


@pytest.mark.parametrize(
    ("passphrase", "account_id"), [("wrong horse battery", "brk_1"), (PASSPHRASE, "brk_2")]
)
def test_wrong_passphrase_or_other_account_fails(passphrase: str, account_id: str) -> None:
    blob = seal("kite-secret", PASSPHRASE, "brk_1")

    with pytest.raises(WrongPassphrase):
        unseal(blob, passphrase, account_id)


@pytest.mark.parametrize("damage", ["flip", "truncate", "version"])
def test_tampered_blob_fails(damage: str) -> None:
    blob = bytearray(seal("kite-secret", PASSPHRASE, "brk_1"))
    if damage == "flip":
        blob[-1] ^= 1
    elif damage == "truncate":
        blob = blob[:29]
    else:
        blob[0] = 2

    with pytest.raises(WrongPassphrase):
        unseal(bytes(blob), PASSPHRASE, "brk_1")
