from dataclasses import replace

from intraday_factory import BASE, T, day_ticks, eager_depth, ms
from nova_backtest.intraday import fills
from nova_backtest.intraday.fills import DepthAt, Fill, LevelUse, Refusal

STOP = 9_800


def buy(
    tape: list[T], attempt: str, want: int = 100, stop: int = STOP, **changes: int
) -> Fill | Refusal:
    ticks = day_ticks("INFY", tape)
    execution = replace(BASE, **changes)
    return fills.buy(ticks, DepthAt(eager_depth), ms(attempt), want, stop, execution, 5, LevelUse())


def test_delay_picks_the_quote_at_decision_plus_delay() -> None:
    tape = [
        T("09:30:00", 10_000, bid=9_998, ask=10_002),
        T("09:30:01", 10_100, bid=10_098, ask=10_102),
    ]
    base = buy(tape, "09:30:00.250")
    stress = buy(tape, "09:30:01.000")
    assert isinstance(base, Fill) and isinstance(stress, Fill)
    assert (base.price, base.at_ms) == (10_002, ms("09:30:00.250"))
    assert (stress.price, stress.at_ms) == (10_102, ms("09:30:01"))


def test_a_newer_tick_within_the_quote_age_is_used_when_the_last_one_is_old() -> None:
    tape = [
        T("09:29:50", 10_000, bid=9_998, ask=10_002),
        T("09:30:01", 10_010, bid=10_008, ask=10_012),
    ]
    fill = buy(tape, "09:30:00.250")
    assert isinstance(fill, Fill) and fill.price == 10_012 and fill.at_ms == ms("09:30:01")


def test_stale_and_missing_quotes_are_refused() -> None:
    old = [T("09:29:55", 10_000, bid=9_998, ask=10_002), T("09:30:05", 10_000, 9_998, 10_002)]
    assert buy(old, "09:30:00.250") == Refusal("stale_quote", ("stale_quote",))
    no_ask = [T("09:30:00", 10_000, bid=9_998), T("09:30:01", 10_000, bid=9_998)]
    assert buy(no_ask, "09:30:00.250") == Refusal("no_quote", ("no_quote",))


def test_spread_gates() -> None:
    wide = [T("09:30:00", 10_000, bid=9_990, ask=10_010)]  # 20 bps
    assert buy(wide, "09:30:00.250") == Refusal("wide_spread", ("wide_spread",))
    no_bid = [T("09:30:00", 10_000, ask=10_002)]
    assert buy(no_bid, "09:30:00.250") == Refusal("wide_spread", ("wide_spread",))
    near_stop = [T("09:30:00", 10_000, bid=10_000, ask=10_002)]  # spread 2 of a 12 stop room
    assert buy(near_stop, "09:30:00.250", stop=9_990) == Refusal(
        "spread_to_stop", ("spread_to_stop",)
    )
    both = buy(wide, "09:30:00.250", stop=9_990)
    assert isinstance(both, Refusal) and both.reasons == ("wide_spread", "spread_to_stop")


def test_thin_depth_partial_fill_and_tick_slippage() -> None:
    thin = [T("09:30:00", 10_000, bid=9_998, ask=10_002, ask_qty=100)]  # 10 a level usable
    assert buy(thin, "09:30:00.250", want=300) == Refusal("too_little_depth", ("too_little_depth",))
    partial = buy(thin, "09:30:00.250", want=150)
    assert isinstance(partial, Fill) and partial.qty == 50
    assert partial.value == 10 * (10_002 + 10_007 + 10_012 + 10_017 + 10_022)
    slipped = buy(thin, "09:30:00.250", want=20, slippage_ticks=3)
    assert isinstance(slipped, Fill) and slipped.value == 10 * 10_017 + 10 * 10_022


def test_a_level_is_not_used_twice_on_one_tick() -> None:
    ticks = day_ticks("INFY", [T("09:30:00", 10_000, bid=9_998, ask=10_002, bid_qty=100)])
    levels, depth = LevelUse(), DepthAt(eager_depth)
    first = fills.sell(ticks, depth, 0, 25, BASE, 5, levels)
    second = fills.sell(ticks, depth, 0, 100, BASE, 5, levels)
    assert first is not None and second is not None
    assert (first.qty, first.value) == (25, 10 * 9_998 + 10 * 9_993 + 5 * 9_988)
    assert (second.qty, second.value) == (20, 10 * 9_983 + 10 * 9_978)  # levels 4 and 5 only
    assert fills.sell(ticks, depth, 0, 100, BASE, 5, levels) is None
