from typing import Any

from intraday_factory import ms
from nova_backtest.intraday.guard import REASONS, Guard, Verdict, ordered
from nova_contracts import default_research_settings

CAPITAL = 100_000_000  # ₹10 L: 0.10 % = ₹1,000 risk, 15 % = ₹1.5 L stock cap
WINDOW = (ms("09:30:00"), ms("14:30:00"))


def guard(sectors: dict[str, str] | None = None, **account: Any) -> Guard:
    settings = default_research_settings().account.model_copy(update=account)
    return Guard(settings, CAPITAL, sectors or {}, lambda _b, _s: 0)


def entry(
    g: Guard,
    symbol: str,
    at: str = "10:00:00",
    price: int = 10_000,
    stop: int = 9_800,
    signals: list[str] | None = None,
) -> Verdict:
    moment = ms(at)
    return g.review_entry(symbol, moment + 250, WINDOW, signals or [], price, stop, {}, moment)


def test_risk_sizes_the_first_buy_and_reserves_its_capacity() -> None:
    g = guard()
    verdict = entry(g, "INFY")
    assert verdict.reasons == [] and verdict.qty == 500  # ₹1,000 ÷ ₹2 a share
    assert g.committed("initial") == 500 * 10_000 and g.open_risk() == 100_000


def test_fourth_stock_is_blocked_by_max_positions() -> None:
    g = guard({s: s for s in "ABCD"}, open_risk_percent=1)
    for symbol in ("A", "B", "C"):
        assert entry(g, symbol, stop=9_900).reasons == []
    assert entry(g, "D", stop=9_900).reasons[0] == "max_positions"


def test_open_risk_and_position_risk() -> None:
    g = guard(max_positions=10)
    assert entry(g, "A").qty == 500 and entry(g, "B").qty == 500  # 0.20 % open risk used up
    assert entry(g, "C").reasons == ["open_risk"]
    tight = guard(risk_per_position_percent=0.00001, open_risk_percent=0.2)
    assert entry(tight, "A").reasons == ["position_risk"]  # ₹10 cannot cover a ₹2 risk share…
    assert entry(tight, "A", stop=9_999).qty == 10  # …but ten 1-paise risks fit


def test_stock_and_sector_caps_and_the_pool() -> None:
    g = guard({"A": "Banks", "B": "Banks", "C": "IT"}, max_positions=10)
    assert entry(g, "A", stop=9_990).qty == 1_500  # risk allows 10,000; the 15 % stock cap 1,500
    assert entry(g, "B", stop=9_990).qty == 500  # 20 % sector cap − ₹1.5 L already in Banks
    pool = guard(max_positions=10, initial_pool_percent=1)
    assert entry(pool, "A", stop=9_990).qty == 100  # a ₹10,000 pool
    assert entry(pool, "B", stop=9_990).reasons == ["initial_pool"]
    full = guard({"A": "Banks", "B": "Banks"}, max_positions=10, sector_cap_percent=15)
    entry(full, "A", stop=9_990)
    assert entry(full, "B", stop=9_990).reasons == ["sector_cap"]
    reserve = guard(max_positions=10, reserve_percent=99.5, initial_pool_percent=0.5)
    entry(reserve, "A", stop=9_990)
    assert entry(reserve, "B", stop=9_990).reasons == ["initial_pool", "cash_reserve"]


def test_unclassified_stocks_share_one_sector() -> None:
    g = guard({"A": "", "B": "IT"}, max_positions=10, sector_cap_percent=15)
    entry(g, "A", stop=9_990)
    assert entry(g, "Z", stop=9_990).reasons == ["sector_cap"]  # unknown → Unclassified too
    assert entry(g, "B", stop=9_990).reasons == []


def test_pools_and_risk_are_released_when_a_position_closes() -> None:
    g = guard(max_positions=1)
    hold = entry(g, "A").hold
    assert hold is not None
    g.filled(hold, 500 * 10_000, 100_000, first_buy=True)
    assert entry(g, "B").reasons == ["max_positions"]
    g.close("A", -1_000, ms("10:30:00"))
    assert entry(g, "B", at="10:31:00").reasons == []
    assert g.cash == CAPITAL - 1_000


def test_a_refused_attempt_releases_its_reservation() -> None:
    g = guard(max_positions=1)
    hold = entry(g, "A").hold
    assert hold is not None
    g.release(hold)
    assert g.holds == {} and entry(g, "B").reasons == []


def test_losing_streak_cooldown_new_limit_and_entry_window() -> None:
    g = guard(max_positions=10, max_new_positions_per_day=3)
    for n, symbol in enumerate(("A", "B")):
        hold = entry(g, symbol).hold
        assert hold is not None
        g.filled(hold, 1, 1, first_buy=True)
        g.close(symbol, -1, ms(f"10:0{n}:00"))
    assert entry(g, "C", at="10:05:00").reasons == ["loss_pause"]
    g.day.streak = 0
    assert entry(g, "A", at="10:10:00").reasons == ["cooldown"]  # closed 10:00 + 15 min
    hold = entry(g, "A", at="10:15:00").hold
    assert hold is not None
    g.filled(hold, 1, 1, first_buy=True)
    assert entry(g, "D", at="10:16:00").reasons == ["daily_new_limit"]
    assert entry(guard(), "A", at="14:29:59").reasons == []  # attempt 14:29:59.250 < 14:30
    assert entry(guard(), "A", at="14:30:00").reasons == ["entry_window"]


def test_zero_does_not_reset_the_streak_and_a_win_does() -> None:
    g = guard()
    g.close("A", -1, 0)
    g.close("B", 0, 0)
    assert g.day.streak == 1
    g.close("C", 5, 0)
    assert g.day.streak == 0


def test_daily_loss_shuts_the_day_once() -> None:
    g = guard()
    g.close("A", -200_000, 0)  # −₹2,000 realised
    assert g.daily_loss_hit(-99_999) is False
    assert g.daily_loss_hit(-100_000) is True  # −₹3,000 = 0.30 % of ₹10 L
    assert g.daily_loss_hit(-500_000) is False  # already shut
    assert entry(g, "B").reasons == ["daily_shutdown"]
    g.start_day()
    assert entry(g, "B").reasons == []


def test_every_failed_check_is_kept_in_order() -> None:
    g = guard(max_positions=1)
    entry(g, "A")
    verdict = entry(g, "B", at="14:40:00", signals=["context", "market_gate"])
    assert verdict.reasons == ["entry_window", "market_gate", "context", "max_positions"]
    assert ordered(["zero_qty", "no_quote", "cooldown"]) == ["cooldown", "no_quote", "zero_qty"]
    assert len(REASONS) == len(set(REASONS)) == 27


def test_a_fill_is_cut_to_the_room_at_the_real_prices() -> None:
    g = guard()
    hold = entry(g, "A").hold  # 500 shares sized at ₹100 with a ₹98 stop
    assert hold is not None
    # The asks moved up: 300 at ₹100.10, 300 at ₹100.20 → each share risks more than ₹2.
    qty, value = g.fit(hold, 9_800, [(300, 10_010), (300, 10_020)])
    assert (qty, value) == (468, 300 * 10_010 + 168 * 10_020)  # ₹999.60 of the ₹1,000 room
    hold.allowance = 100
    assert g.fit(hold, 9_800, [(10, 10_000)]) == (0, 0)  # …one share risks ₹2 > ₹1: invalid


def test_entries_waiting_for_their_fill_count_toward_the_new_position_limit() -> None:
    g = guard(
        {s: s for s in "ABC"}, max_positions=10, max_new_positions_per_day=2, open_risk_percent=1
    )
    assert entry(g, "A").reasons == [] and entry(g, "B").reasons == []
    assert entry(g, "C").reasons == ["daily_new_limit"]
