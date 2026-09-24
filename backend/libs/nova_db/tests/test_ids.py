import re
import time

import pytest
from nova_db.ids import new_id


def test_id_has_prefix_and_fixed_length() -> None:
    assert re.fullmatch(r"run_[0-9a-f]{22}", new_id("run"))


def test_ids_sort_by_creation_time() -> None:
    first = new_id("stg")
    time.sleep(0.002)
    second = new_id("stg")

    assert first < second


def test_ids_are_unique() -> None:
    assert len({new_id("trd") for _ in range(1000)}) == 1000


@pytest.mark.parametrize("prefix", ["", "R", "run1", "toolongprefix", "a"])
def test_bad_prefix_is_rejected(prefix: str) -> None:
    with pytest.raises(ValueError):
        new_id(prefix)
