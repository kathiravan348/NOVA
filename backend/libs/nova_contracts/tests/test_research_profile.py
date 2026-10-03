import json

import pytest
from nova_contracts import (
    ResearchProfile,
    ResearchProfileCreate,
    ResearchProfileVersion,
    ResearchProfileVersionCreate,
    ResearchProfileVersionUpdate,
    ResearchSettings,
    default_research_settings,
)
from nova_testing.parity import Parity
from pydantic import ValidationError


def test_defaults_and_every_wire_model_match_schema(parity: Parity) -> None:
    raw = parity.mock("researchProfiles")[0]
    profile = ResearchProfile.model_validate_json(json.dumps(raw))
    settings = default_research_settings()
    assert profile.model_dump(mode="json") == raw
    assert settings.model_dump(mode="json") == raw["versions"][1]["settings"]
    models = [
        settings,
        profile,
        *profile.versions,
        ResearchProfileCreate(name="Plan", description="", settings=settings),
        ResearchProfileVersionCreate(note="", settings=settings),
        ResearchProfileVersionUpdate(settings=settings),
    ]
    for model in models:
        parity.assert_valid(model.model_dump(mode="json"), type(model).__name__)
        with pytest.raises(ValidationError):
            type(model).model_validate(model.model_dump(mode="json") | {"unknown": True})


@pytest.mark.parametrize(
    "group,field,value,message",
    [
        ("account", "reservePercent", 61, "Pools must sum to at most 100 percent"),
        ("account", "openRiskPercent", 0.05, "Open risk must be at least position risk"),
        ("execution", "stressDelayMs", 200, "Stress delay must be at least base delay"),
        ("execution", "stressSlippageTicks", 0, "Stress slippage must be at least base slippage"),
        ("signal", "maxStopAtr", 0.5, "Maximum stop ATR must exceed minimum stop ATR"),
        (
            "timing",
            "lastEntry",
            "09:30",
            "Entry times must satisfy earliestEntry < lastEntry < squareOff",
        ),
        (
            "timing",
            "squareOff",
            "14:30",
            "Entry times must satisfy earliestEntry < lastEntry < squareOff",
        ),
    ],
)
def test_relationship_messages(group: str, field: str, value: object, message: str) -> None:
    # Dict values are arbitrary JSON scalars/groups used to exercise the wire validator.
    settings = json.loads(default_research_settings().model_dump_json())
    settings[group][field] = value
    with pytest.raises(ValidationError, match=message):
        ResearchSettings.model_validate_json(json.dumps(settings))


@pytest.mark.parametrize(
    "group,field,value",
    [
        ("account", "initialPoolPercent", 0),
        ("account", "stockCapPercent", 101),
        ("account", "addPoolPercent", -1),
        ("account", "reservePercent", -1),
        ("account", "maxPositions", 21),
        ("account", "maxPositions", 1.5),
        ("account", "maxNewPositionsPerDay", 51),
        ("account", "lossStreakPause", 11),
        ("account", "riskPerPositionPercent", 5.1),
        ("account", "openRiskPercent", 10.1),
        ("account", "dailyLossPercent", 0),
        ("account", "cooldownMinutes", -1),
        ("execution", "delayMs", -1),
        ("execution", "stressDelayMs", 10001),
        ("execution", "slippageTicks", 21),
        ("execution", "maxQuoteAgeMs", 99),
        ("execution", "maxQuoteAgeMs", 60001),
        ("execution", "maxSpreadBps", 201),
        ("execution", "minFillPercent", 0),
        ("execution", "maxDepthPercent", 101),
        ("market", "marketGate", "true"),
        ("market", "marketIndex", "nifty 50"),
        ("market", "indexRangeMinutes", 0),
        ("signal", "minRelativeVolume", 0),
        ("signal", "volumeBaselineSessions", 4),
        ("signal", "volumeBaselineSessions", 61),
        ("signal", "atrPeriod", 1),
        ("signal", "atrPeriod", 51),
        ("signal", "contextEmaPeriod", 101),
        ("signal", "rangeSpanAtr", 21),
        ("timing", "earliestEntry", "09:14"),
        ("timing", "squareOff", "15:30"),
        ("timing", "earliestEntry", "9:30"),
        ("timing", "earliestEntry", "09:30\n"),
        ("timing", "maxHoldMinutes", 376),
        ("data", "maxSessionGapSeconds", 301),
        ("data", "maxSessionGapSeconds", -1),
    ],
)
def test_invalid_field_ranges(group: str, field: str, value: object) -> None:
    settings = json.loads(default_research_settings().model_dump_json())
    settings[group][field] = value
    with pytest.raises(ValidationError):
        ResearchSettings.model_validate_json(json.dumps(settings))


@pytest.mark.parametrize("group", ["account", "execution", "market", "signal", "timing", "data"])
def test_settings_groups_are_strict(group: str) -> None:
    settings = json.loads(default_research_settings().model_dump_json())
    settings[group]["unknown"] = True
    with pytest.raises(ValidationError):
        ResearchSettings.model_validate_json(json.dumps(settings))


def test_optional_zero_values() -> None:
    settings = json.loads(default_research_settings().model_dump_json())
    settings["account"].update(addPoolPercent=0, reservePercent=0, lossStreakPause=0)
    settings["execution"].update(delayMs=0, slippageTicks=0)
    settings["data"]["maxSessionGapSeconds"] = 0
    ResearchSettings.model_validate_json(json.dumps(settings))


def test_decimal_pools_summing_to_100_are_accepted() -> None:
    settings = json.loads(default_research_settings().model_dump_json())
    settings["account"].update(initialPoolPercent=33.3, addPoolPercent=33.3, reservePercent=33.4)
    ResearchSettings.model_validate_json(json.dumps(settings))


def test_freeze_invariants_and_version_order(parity: Parity) -> None:
    raw = parity.mock("researchProfiles")[0]
    draft = raw["versions"][0]
    for update in [
        {"version": 0},
        {"hash": "a" * 64},
        {"frozenAt": draft["createdAt"]},
        {"frozen": True},
        {"frozen": True, "hash": "invalid", "frozenAt": draft["createdAt"]},
    ]:
        with pytest.raises(ValidationError):
            ResearchProfileVersion.model_validate_json(json.dumps(draft | update))
    for versions in [list(reversed(raw["versions"])), [draft, draft]]:
        with pytest.raises(ValidationError):
            ResearchProfile.model_validate_json(json.dumps(raw | {"versions": versions}))
