# NOVA-109 — Engine: numpy bar columns; indicators and visual rules on arrays (D61)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-109 · **Depends on:** —

## Goal
Step 1 of the streaming engine (D61). Bars are loaded as numpy columns, indicators return float64 arrays and
visual rules become whole-array `enter`/`exit` bool arrays, computed **one stock at a time**. Every signal,
trade and number stays exactly as today. `simulate.py` does not change; NOVA-110 replaces it.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D45, D51, D59, D61; every file under Files

## Files
Create:
- `backend/services/backtest/src/nova_backtest/columns.py`, `backend/services/backtest/tests/test_columns.py`
- `backend/services/backtest/tests/reference_rules.py` (today's `rules.py`, copied as the test reference)
Modify:
- `backend/services/backtest/pyproject.toml`, `backend/uv.lock` (numpy)
- `backend/services/backtest/src/nova_backtest/{indicators,indicators_core,indicators_trend,indicators_momentum,indicators_levels,indicators_volume,rules,sandbox,strategy_engine}.py`
- `backend/services/backtest/tests/{test_indicators,test_indicators_levels,test_indicators_momentum,test_indicators_trend,test_indicators_volume,test_rules,test_sandbox}.py`
  (call sites only: build `Columns.from_bars(...)`; expected values never change)

## Build
1. In `backend/services/backtest`, run `uv add numpy`, then make the pin exact (`==`, AGENTS §5). Put the version in the handoff.
2. `columns.py`: frozen dataclass `Columns` of `npt.NDArray[np.int64]` fields: `ts` (UTC epoch seconds), `open`, `high`,
   `low`, `close` (paise), `volume`, plus `day` (`int32` IST date ordinal). Add `__len__`, `from_bars(bars)`, `to_bars()` (for the
   simulator until NOVA-110), and `load(db, exchange, symbol, timeframe, start, end)`. `load` calls `read_bars` once per calendar
   year, with windows cut at IST midnight so no rolled-up bucket straddles two windows, and concatenates the results. It keeps no
   list of BarRow objects beyond one window.
3. Indicators: every function that takes `Sequence[Bar]` takes `Columns` instead. `rupees()` returns plain Python float lists
   (`(col / 100).tolist()`), so the algorithms and their float results stay identical. `vwap` and the previous-day levels use `day`.
   `indicator(name, params, columns)` returns `npt.NDArray[np.float64]`, with NaN where it returns `None` today.
4. `rules.py`: `SeriesCache(columns)` caches arrays. `offset` shifts right and fills NaN. Add
   `signals(columns, entry, exit_) -> tuple[bool array, bool array]`, vectorised with today's meaning: any NaN operand → False;
   crosses need both values of the previous bar and are False at index 0; `eq` is `abs(a - b) < 1e-9`; `all`/`any` over conditions.
   `RuleSignals(signals_by_symbol)` keeps the `Signals` protocol by reading the arrays.
5. `strategy_engine.py`: load each stock as `Columns`, keep today's bar-limit check, and compute that stock's signal arrays
   straight away (visual mode), so no stock's indicator arrays outlive its turn. Then build the `Bar` lists for `simulate` with
   `to_bars()`. Python mode keeps passing `Bar` lists to `run_python`.
6. `sandbox.py`: compute the `ctx` indicator series from `Columns.from_bars(rows)`, turning NaN into `None` for the JSON.
7. `reference_rules.py`: a copy of today's `SeriesCache`, `_holds` and `holds`, used only by the tests. Add a test comment:
   "reference for NOVA-109 parity; delete after NOVA-111".

## Acceptance checks
- [ ] Every existing backtest test passes with **unchanged expected values**. This includes `test_engine.py`, which proves the trades are identical.
- [ ] Differential test: on 30 seeded random bar series (300 bars each, including flat stretches), for every operator × operand kind
      (price / indicator with offset / number) and both combinators, `signals()` equals `reference_rules.holds` at every index.
- [ ] `Columns.load` over a 3-year period returns the same rows as one `read_bars` call, for `1d` and for a rolled-up `15m` (db fixture).
- [ ] Each indicator's array equals today's `Series` value for value (NaN ↔ `None`).
- [ ] `docker compose run --rm backend-check` passes (ruff, format, mypy strict with numpy types, pytest). Guides: none.

## Out of scope
- Changing `simulate.py`, scratch files or fill order (NOVA-110); the Python sandbox's per-stock runs or bar limits (NOVA-111).
- New indicators or spec fields (NOVA-114–117); frontend; any change to numbers or messages users see.

## Questions
_(implementer writes here if blocked)_

## Handoff
Done. `numpy==2.5.3` (exact pin, `uv.lock`). `columns.py`: `Columns` (int64 `ts` epoch seconds, OHLC paise, volume;
int32 IST `day`), `from_bars`, `to_bars`, `time(i)`, and `load()` that reads one IST calendar year at a time and turns each
window into arrays at once. Indicators take `Columns` (same algorithms, same float results: `rupees()` is `col / 100`);
`indicator()` still returns the `None`-padded list (exact engine values, Python ctx JSON), `indicator_array()` gives
float64 with NaN. `rules.py`: `SeriesCache` of arrays, `condition_holds` / `group_holds` over whole arrays (NaN never
holds; crosses need both previous values; `eq` within 1e-9), `signals(columns, entry, exit)`, `check_group`,
`RuleSignals.from_arrays`; `holds(group, cache, i)` kept for bar-by-bar callers. The engine loads each stock as columns and
computes its visual signal arrays straight away, then hands `to_bars()` lists to the unchanged simulator.
- Deviation: `indicator()` keeps returning lists (with `indicator_array()` beside it) so every expected value and the
  sandbox JSON stay as they were. The per-bar reference lives inside `test_columns.py` (pytest does not import sibling
  modules here), not in `reference_rules.py`.
- Tests: 30 random series × 84 rule groups equal the per-bar reference; every catalog indicator's array equals its list
  (daily and 15m bars); `load()` over 3 years equals one `read_bars` for 1d and rolled-up 15m. Existing values unchanged.
Commands: backend-check 766 passed. Guides: none.

## Review
Built and reviewed by Claude. Acceptance checks pass. Merged.
