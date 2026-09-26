"""The Atlas CLI keeps only the worker; routine actions are started from Relay (D55)."""

import pytest
from nova_atlas.cli import main


def test_help_lists_only_worker(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main(["--help"])
    assert exit_info.value.code == 0
    out = capsys.readouterr().out
    assert "worker" in out
    for removed in ("sync-instruments", "download", "archive-ticks"):
        assert removed not in out


@pytest.mark.parametrize("command", ["sync-instruments", "download", "archive-ticks"])
def test_removed_commands_are_refused(command: str) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main([command])
    assert exit_info.value.code == 2
