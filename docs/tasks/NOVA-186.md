# NOVA-186 — Intraday simulator: risk sizing, account guard, skip-reason log (D84, migration 0034)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-186 · **Depends on:** NOVA-185

## Goal
Every intraday candidate passes the account checks of `docs/INTRADAY-RESEARCH.md` §2 (Account) and §5 (2–4) before a
fill, is sized by risk with real charges, and leaves one row in a decision log with its first blocking reason and
every failed check, so a quiet run can be told apart from a strict rule or bad data.

## Read first
- `AGENTS.md` §7a, §8; `docs/INTRADAY-RESEARCH.md` §2, §5, §10; the `intraday/` files of NOVA-185

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0034_intraday_decisions.py`
- `backend/services/backtest/src/nova_backtest/intraday/guard.py`, `sizing.py`, `decisions.py`
- `backend/services/backtest/tests/test_intraday_guard.py`, `test_intraday_sizing.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/backtest.py`, `models/__init__.py`, `backend/libs/nova_db/tests/test_migrations.py`
- `backend/services/backtest/src/nova_backtest/intraday/replay.py`, `engine.py`; `tests/test_intraday_replay.py`
- `docs/guides/DATABASE.md`

## Build
1. Migration 0034: table `intraday_decisions` (`id` PK, `run_id` → backtest_runs cascade, `at` (decision time),
   `symbol`, `setup`, `action` `entry`|`add`, `outcome` `filled`|`partial`|`skipped`, `first_reason` null,
   `reasons` text[], `requested_qty`, `filled_qty`, `trade_id` null → trades set null; index (`run_id`, `at`)).
   `reasons` values are exactly the §5.4 names.
2. `sizing.py`: largest whole quantity whose loss to the stop + estimated cost to close (NOVA Ledger charges for
   that quantity, both legs) fits the remaining position risk, then capped by every money limit and depth. Search,
   not a constant cost per share (guide ch. 3). Money in integer paise.
3. `guard.py` keeps the account state per run: committed initial / add capital (released on exit), reserve, stock
   and sector exposure (instrument sector; `Unclassified` is its own sector), open + pending risk, positions,
   new positions today, losing-streak count (whole positions, zero P&L does not reset it), cooldown per stock,
   entry window (attempt time < `lastEntry`). Daily loss = realised + open marked at the best bid − exit charges,
   checked at every fill and 1m close; at the limit: cancel pending entries/adds, exit all, no new risk that day
   (exit reason `daily_shutdown`).
4. Checks run in the §5.4 order; the first failure is `first_reason`, all failures are kept. Candidates at the same
   moment are ranked: earlier decision, then higher relative volume (0 until NOVA-187), then symbol; reserve
   capacity in that order so two candidates never spend the same pool.
5. `decisions.py` writes the log in batches (bounded memory); `engine.py` saves it with the run.

## Acceptance checks
- [ ] Sizing tests: guide ch. 16 example (₹100 entry, ₹98 stop, ₹1,000 risk) gives ≤ 450 shares with real charges;
      quantity drops when charges are counted; stock cap and pools cut it further.
- [ ] Guard tests: 4th stock → `max_positions`; sector cap; open risk; pools released on exit; daily shutdown
      stops new entries and exits all; 2 losses → `loss_pause`; cooldown 15 min; 14:30 cutoff.
- [ ] Decision log: one row per candidate, right `first_reason`, full `reasons`; backend-check passes.

## Out of scope
- Market gate, context, relative volume, ATR checks (187); setups (188, 189); adds (190); report endpoints (192).
- Deploy after 15:45 IST or at a weekend (D76): migrate 0034, then `backtest backtest-worker` with `--no-deps`.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** migration 0034 (`intraday_decisions`); `sizing.py` (risk search with real charges), `guard.py` (account
state, §5.4 order, reservations, daily shutdown), `decisions.py` (one row per candidate per session, trade ids linked
at save); replay and engine use them.
**Files changed:** the listed files, plus `intraday/fills.py` (fills keep their per-level parts so the guard can cut a
fill to the room at the real prices), `tests/intraday_factory.py` (`FixedQtyGuard`), `docs/guides/API.md` (sizing text).
**Commands run:** `docker compose run --rm backend-check` pass (1,582 tests).
**New dependencies:** none. **Maps updated:** none. **Guides updated:** DATABASE, API.
**Deviations from task:** guide ch. 16 "≤ 450 shares" holds with the guide's ₹100 cost reserve (test); real charges
for that example are about ₹50, so real sizing gives 475 (tested: < 500 and the largest fitting quantity).
Sizing starts from the last ask at the decision + slippage; the fill is cut when real prices need it (`partial`).
Pools are released when a position closes fully; the losing streak and cooldowns reset each day.
**Known gaps:** relative volume ranks 0 until NOVA-187; signal checks arrive in NOVA-187.

## Review
**Result:** done
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner asked for self-review, 4 Oct 2026; same session).
**Fixed directly (review: commits):** entries waiting for their fill now count toward `maxNewPositionsPerDay`
(two candidates of one minute could pass the limit) + test.
**Change requests:** none.
**Guides checked:** DATABASE (0034, map, table) and API (sizing/guard text replaced the "1 share" note) match the diff.
**Rulebook issues found:** none. Deploy (migrate 0034, `backtest backtest-worker`) waits for a quiet time (D76).
**Follow-up tasks created:** none.
