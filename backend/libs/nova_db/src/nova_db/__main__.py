"""`python -m nova_db upgrade|downgrade|check [revision]` against `NOVA_DATABASE_URL`."""

import argparse
import logging
import os
import sys

from nova_db.migrate import diff, downgrade, upgrade


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m nova_db")
    parser.add_argument("command", choices=["upgrade", "downgrade", "check"])
    parser.add_argument("revision", nargs="?")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(name)s: %(message)s")

    url = os.environ.get("NOVA_DATABASE_URL")
    if not url:
        print("NOVA_DATABASE_URL is not set", file=sys.stderr)
        return 2

    if args.command == "upgrade":
        upgrade(url, args.revision or "head")
    elif args.command == "downgrade":
        downgrade(url, args.revision or "base")
    else:
        differences = diff(url)
        for item in differences:
            print(item)
        return 1 if differences else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
