# NOVA-115 — Engine: ranked buys, max positions, trailing/ATR/time exits, multiplier (D62)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-115 · **Depends on:** NOVA-111, NOVA-114

## Goal
The engine runs the D62 (3) spec fields that NOVA-114 added, except `regime` (NOVA-117): operand `multiplier`,
`portfolio` (max positions, ranked buys), `trailingStopPercent`, `atrStop` and `maxHoldBars`. Specs without them give
exactly today's results.

## Read first
- `AGENTS.md`; `docs/DECISIONS.md` D45, D53, D61, D62; every file under Files

## Files
Create:
- `backend/services/backtest/src/nova_backtest/exits.py`, `backend/services/backtest/tests/test_exits.py`
Modify:
- `backend/services/backtest/src/nova_backtest/{rules,simulate,book,scratch,strategy_engine}.py`
- `backend/services/backtest/tests/{test_rules,test_simulate,test_engine,reference_simulate}.py`

## Build
1. `rules.py`: an operand's value = series (offset applied first) × `multiplier` when set. This applies everywhere an operand
   is used: rules, rank and, later, regime and score.
2. Pass 1 (`strategy_engine.py`): when `portfolio.rank` is set, save that operand's array per stock as `rank`. When `atrStop`
   is set, save `atr(period)` per stock. Both go into the scratch folder (`scratch.py` gets optional extra arrays).
3. Step b (buys), `simulate.py`:
   - Free slots = `maxPositions` − holdings, counted after step a's sells. No portfolio = unlimited, as today.
   - Buys waiting at this bar time are taken best-ranked first: rank value at their signal bar, `desc` or `asc`, NaN last,
     ties by symbol. They are filled until there are no free slots or not enough cash.
   - A buy that is not filled is dropped, as today.
4. `exits.py` + `book.Position`: track `highest_close` since the first buy and `bars_held` (the entry bar counts 1). At each
   close, set these levels (each only moves up):
   - trailing: `highest_close × (1 − trailingStopPercent/100)`
   - ATR: `highest_close − multiplier × ATR` at that close

   From the **next** bar, the stop level is the highest of the fixed stop (on the average price, from the entry bar as today),
   the trailing level and the ATR level. It fills at `min(open, level)`. `maxHoldBars`: at the close where `bars_held` reaches
   N, queue an exit for the next open. Step c order stays: adds → stop → target.
5. `strategy_engine.py`, until NOVA-117: a spec with `regime`, or in rotation mode, fails the run with "This strategy uses a
   market filter or rotation, which backtests do not support yet". No setting is ever silently ignored.
6. `reference_simulate.py` gets the same features in plain in-memory form. The random differential test adds cases with a
   portfolio (both orders, NaN ranks), each exit type and multipliers.

## Acceptance checks
- [ ] Hand-made tests: 3 stocks signal on the same day with max 2 → the 2 best-ranked are bought (desc and asc cases); NaN rank last.
- [ ] Trailing and ATR levels rise and never fall; the fill is at the open on a gap; checks start the bar after the level is set;
      a fixed stop that is higher wins; `maxHoldBars` 3 exits at the open of bar 4.
- [ ] `volume > 1.5 × volume_sma(3)` holds exactly on the bars expected; offset + multiplier combined.
- [ ] Random differential test (200 cases) passes; every old test passes unchanged.
- [ ] `docker compose run --rm backend-check` passes. Guides: none (the editor fields and guide come in NOVA-118).

## Out of scope
- `regime`, rotation mode (NOVA-117); new indicators and metrics (NOVA-116); editor (NOVA-118).

## Questions
_(implementer writes here if blocked)_

## Handoff
Done. `rules.py`: an operand = cached plain series → `offset` shift → × `multiplier`. `exits.py`: `at_close` (bars held,
highest close, trailing and ATR levels that only move up), `stop_level` (highest of fixed, trailing, ATR),
`held_long_enough`. `book.Position` gains `highest_close`, `bars_held`, `trail`. `scratch.py`/`timeline.py`: optional
`rank` and `atr` arrays per stock (NaN when absent). `simulate.py` step b takes the whole bar-time group: waiting buys
sorted by rank at their signal close (desc/asc, NaN last, ties by symbol), filled while `len(positions) < maxPositions`;
the rest are dropped. Averaging's "stop at or above the trigger" test now uses the combined stop level.
`strategy_engine.py`: pass 1 saves `rank` (`SeriesCache.values(portfolio.rank.by)`) and `atr(period)` when used, for
visual and Python specs; every operand's settings are checked up front; only `regime`/rotation still fail
("This strategy uses a market filter or rotation, which backtests do not support yet").
- Tests: `test_exits.py` (ranked desc/asc/NaN, symbol order without rank, trailing rise + gap fill + next-bar check, ATR
  never falls, higher fixed stop wins, `maxHoldBars` 3 → open of bar 4); `test_rules.py` (`volume > 1.5 × volume_sma(3)`,
  offset then multiplier); engine end-to-end run with every new setting. Differential test: 200 cases now add
  portfolios (none/plain/desc/asc, 20 % NaN ranks, 1–3 slots), trailing, ATR, max-hold; 104 cases trade differently
  from the same case without D62 settings. No old expected value changed.
Commands: backend-check 980 passed. Guides: none.

## Review
Built and reviewed by Claude. Acceptance checks pass. Merged.
