# NOVA-115 — Engine: ranked buys, max positions, trailing/ATR/time exits, multiplier (D62)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-115 · **Depends on:** NOVA-111, NOVA-114

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
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(Claude, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
