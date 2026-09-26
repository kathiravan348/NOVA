"""Seals the Kite API secret with the Owner's passphrase (D55).

Layout: version (1 byte) | salt (16) | nonce (12) | AES-256-GCM ciphertext + tag. The key is
scrypt(passphrase, salt); the account id is associated data, so a sealed secret cannot be moved to
another account. Neither the passphrase nor the secret is stored or logged.
"""

import hashlib
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

VERSION = b"\x01"
SALT_BYTES = 16
NONCE_BYTES = 12
# ~50-100 ms and 32 MiB per try: cheap once a day, slow for guessing.
SCRYPT_N = 2**15
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_MAXMEM = 64 * 1024 * 1024


class WrongPassphrase(Exception):
    """The passphrase (or the sealed data) does not open the secret."""


def _key(passphrase: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        passphrase.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        maxmem=SCRYPT_MAXMEM,
        dklen=32,
    )


def seal(secret: str, passphrase: str, account_id: str) -> bytes:
    salt = os.urandom(SALT_BYTES)
    nonce = os.urandom(NONCE_BYTES)
    sealed = AESGCM(_key(passphrase, salt)).encrypt(
        nonce, secret.encode("utf-8"), account_id.encode("utf-8")
    )
    return VERSION + salt + nonce + sealed


def unseal(blob: bytes, passphrase: str, account_id: str) -> str:
    header = 1 + SALT_BYTES + NONCE_BYTES
    if len(blob) <= header or blob[:1] != VERSION:
        raise WrongPassphrase
    salt, nonce = blob[1 : 1 + SALT_BYTES], blob[1 + SALT_BYTES : header]
    try:
        plain = AESGCM(_key(passphrase, salt)).decrypt(
            nonce, blob[header:], account_id.encode("utf-8")
        )
    except InvalidTag as exc:
        raise WrongPassphrase from exc
    return plain.decode("utf-8")
