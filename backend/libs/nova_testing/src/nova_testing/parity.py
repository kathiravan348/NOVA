"""Contract parity kit (D34): parse mock JSON, check model output against the Zod JSON Schema.

Paths resolve from this file: the workspace must be installed editable (uv's default) in the repo.
"""

import json
from functools import cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parents[5]
MOCKS_DIR = REPO_ROOT / "frontend" / "packages" / "mocks" / "data"
SCHEMA_DIR = REPO_ROOT / "frontend" / "packages" / "contracts" / "schema"


@cache
def _validator(schema_name: str) -> Draft202012Validator:
    schema = json.loads((SCHEMA_DIR / f"{schema_name}.json").read_text(encoding="utf-8"))
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


class Parity:
    def mock_text(self, name: str) -> str:
        return (MOCKS_DIR / f"{name}.json").read_text(encoding="utf-8")

    def mock(self, name: str) -> Any:  # Any: mock files hold arbitrary JSON
        return json.loads(self.mock_text(name))

    def assert_valid(self, data: object, schema_name: str) -> None:
        found = _validator(schema_name).iter_errors(data)
        errors = [f"{list(e.absolute_path)}: {e.message}" for e in found]
        assert not errors, f"{schema_name} schema violations: {errors}"
