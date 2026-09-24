#!/bin/sh
# All backend checks (D33). Runs inside the backend-check container or on the host via uv (D36).
set -eu
cd "$(dirname "$0")/.."
uv sync --frozen --quiet
uv run --frozen ruff check .
uv run --frozen ruff format --check .
# One mypy run per package: every package has its own tests/ folder with overlapping file names.
for pkg in libs/*/ services/*/; do
  uv run --frozen mypy "$pkg"
done
uv run --frozen pytest -q
