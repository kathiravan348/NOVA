# NOVA-185 — Intraday simulator: tick replay, fill model, exits, unresolved positions (D84, migration 0033)

**Status:** in-progress · **Owner:** Claude · **Branch:** task/NOVA-185 · **Depends on:** NOVA-181, NOVA-183, NOVA-184

## Goal
`mode: "intraday"` runs go to a new simulator (`nova_backtest/intraday/`): recorded ticks, D84 fills and exits. The
candle engine is untouched. `setups/__init__.py` holds the `Setup` protocol (completed bars + context in, `Candidate`
{at, symbol, stop, target, family} out) and a registry by `kind` (unknown → run fails "arrives in NOVA-188/189").

## Read first
- `AGENTS.md` §1, §7a, §8; `docs/DECISIONS.md` D61, D82, D84; `docs/INTRADAY-RESEARCH.md` §1, §2 (execution, timing), §5 (1, 5), §7
- `backend/services/backtest/src/nova_backtest/tick_bars.py`, `quotes.py`, `cli.py`, `engine.py`, `save.py`, `routes.py` (`queue_run`)

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0033_intraday_runs.py`
- `backend/services/backtest/src/nova_backtest/intraday/__init__.py`, `engine.py`, `tick_data.py`, `fills.py`,
  `replay.py`, `position.py`, `dispatch.py`, `setups/__init__.py` (`Setup` protocol, `Candidate`, registry)
- `backend/services/backtest/tests/test_intraday_fills.py`, `test_intraday_replay.py`, `intraday_factory.py` (synthetic ticks)
Modify:
- `backend/libs/nova_db/src/nova_db/models/backtest.py`, `models/__init__.py`, `backend/libs/nova_db/tests/test_migrations.py`
- `backend/services/backtest/src/nova_backtest/cli.py` (dispatching engine), `routes.py` (run checks), `tests/test_api.py`
- `docs/guides/API.md`, `docs/guides/DATABASE.md`

## Build
1. Migration 0033: `backtest_runs` + `profile_id`, `profile_version`, `scenario` (`base`|`stress`), `experiment_id`
   (text, no FK yet), `incomplete` bool default false, `history_inputs` text[] default `{}`; trade exit reasons +
   `daily_shutdown`, `unresolved`; table `intraday_trades` (PK `trade_id` → trades cascade, `stop_paise`,
   `target_paise`, `first_fill_paise`, `risk_paise` (1R per share), `legs` jsonb `[{at, qty, price}]`, `unresolved`).
2. `routes.queue_run`: an intraday strategy needs `dataSource: "recorded"`, a profile + **frozen** version + scenario
   (400 with a plain message otherwise); non-intraday runs must not send them. `dispatch.py` sends each claimed run
   to `IntradayEngine` when the spec mode is `intraday`, else to `StrategyEngine`.
3. `tick_data.py`: per stock and usable day (§7: summarized, `longest_feed_gap_seconds` ≤ profile limit, stock has a
   `tick_days` row) load exchange time, last price, volume, `avg_price_paise`, 5-level bid/ask price+qty, from the
   database or Parquet like `tick_bars.py`, into scratch memmaps; 1m and 5m bars from the same ticks (D82 rules).
4. `fills.py` (§5.5): attempt at decision + delay (scenario); first tick with the side within quote age; spread
   bps and spread/stop gates; walk levels ≤ `maxDepthPercent` each, never reusing a level an earlier fill used on the
   same tick; `minFillPercent`; slippage ticks × `instruments.tick_size_paise` (missing → 5 paise, listed on the run);
   real charges per quantity (NOVA Ledger). Returns a fill or a named failure.
5. `replay.py` + `position.py` (§5.1): 1m closes drive decisions; open positions are checked tick by tick between
   closes for stop (best bid ≤ stop), target (best bid ≥ target), `maxHoldMinutes`, `squareOff`; exits walk bid depth
   and retry the rest on later ticks; no bid by 15:29:59 → trade `unresolved` (valued at the last bid), run
   `incomplete`. Exits before entries at equal times, then by symbol. Sizing here: fixed test quantity (NOVA-186).
6. Save with the shared result writer (trades, equity per day, metrics) + `intraday_trades` rows.

## Acceptance checks
- [ ] Fill tests (fixed test setup): delay, stale quote, spreads, thin depth, partial fill, tick slippage, level reuse.
- [ ] Replay tests: stop on bid, target, time exit, square-off, unresolved at session end, exits before entries.
- [ ] API: intraday run without profile/frozen version/recorded → 400; candle runs unchanged; backend-check passes.

## Out of scope
- Risk sizing and account limits (186), market gate and warm-up (187), real setups (188, 189), adds (190), report (192).
- Deploy after 15:45 IST or at a weekend (D76): migrate 0033, then `backtest backtest-worker` with `--no-deps`.

## Questions
_(implementer writes here if blocked)_

## Handoff
_(implementer, ≤ 20 lines — see `docs/templates/HANDOFF.md`)_

## Review
_(reviewer — Claude or ChatGPT, ≤ 20 lines — see `docs/templates/REVIEW.md`)_
