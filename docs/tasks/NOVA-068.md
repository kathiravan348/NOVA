# NOVA-068 — Python mode: every catalog indicator on `ctx` (D47, D51)

**Status:** planned · **Owner:** — · **Branch:** task/NOVA-068 · **Depends on:** NOVA-066, NOVA-067

## Goal
Python strategies can call any catalog indicator, e.g. `ctx.rsi(14)`, `ctx.supertrend(10, 3)`,
`ctx.macd_signal(fast=12, slow=26, signal=9, ago=1)`, computed by the same code as visual strategies.

## Read first
- `AGENTS.md`, `docs/DECISIONS.md` (D47, D51), `docs/tasks/NOVA-064.md` (catalog)
- `backend/services/backtest/src/nova_backtest/{sandbox.py,sandbox_runner.py,strategy_engine.py,indicators.py}`
- `backend/services/backtest/tests/test_sandbox.py`
- `frontend/apps/nova-orbit/src/pages/editor/editorForm.ts` (`PYTHON_TEMPLATE` only)

## Files
Modify: `nova_backtest/{sandbox.py,sandbox_runner.py,strategy_engine.py}`, `tests/test_sandbox.py`,
`frontend/apps/nova-orbit/src/pages/editor/editorForm.ts` (template comment only), `docs/guides/USER-GUIDE.md`

## Build
1. `sandbox.py`: while checking the AST, collect every call `ctx.<name>(…)` where `<name>` is a catalog name other
   than `sma` (`ctx.sma`, `highest`, `lowest` stay as today, computed in the child). Args must be int/float
   literals: positional in catalog param order, or by param key; optional `ago=<int literal 0–500>`. Anything else
   (a variable, too many args, unknown keyword, bad value via `check_params`) is refused with the line number,
   e.g. "line 7: ctx.rsi settings must be plain numbers".
2. Canonical key per call: name + all params with defaults filled, e.g. `rsi(period=14)`; `ago` is not part of it.
3. `strategy_engine.py`: for each symbol compute each key's series with `indicators.indicator` on the same bars,
   and add `"indicators": {symbol: {key: [value | null, …]}}` to the child request. Update the runner docstring.
4. `sandbox_runner.py` (stays standard-library only): `Context` resolves unknown catalog-shaped attribute calls
   through a small `__getattr__` that builds the same canonical key (it receives the catalog names + param order
   in the request as `"catalog": {name: [keys…]}`) and returns the value at `index − ago`, or `None`.
   Must not open `__` names to user code (the AST check already forbids them in user code).
5. `PYTHON_TEMPLATE` comment: one line listing "any indicator: ctx.rsi(14), ctx.supertrend(10, 3), ago=1".
6. `USER-GUIDE.md` Python section: the call style, `ago`, and that settings must be plain numbers.

## Acceptance checks
- [ ] A Python strategy using `ctx.rsi(14)` gives the same signals as the visual rule "RSI(14) lt 30" on the same
      fixture (sandbox test).
- [ ] `ctx.rsi(n)` with a variable, `ctx.rsi(14, 3)`, `ctx.foo(1)`, `ctx.macd(fast=30, slow=10)` are refused with
      the line number; `ctx.sma(self_n)`-style existing code still works.
- [ ] `ago=1` returns the previous bar's value; the child still runs with no NOVA imports (test asserts the runner
      imports only the standard library).
- [ ] `backend-check` and `pnpm review:check` pass. AGENTS §9.

## Out of scope
- Raw OHLC history arrays on ctx beyond `closes`; dynamic indicator settings; numpy/pandas in the sandbox.

## Questions

## Handoff

## Review
