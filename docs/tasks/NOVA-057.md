# NOVA-057 — Backtest engine: Python-mode strategies in a restricted sandbox

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-057 · **Depends on:** NOVA-062

## Goal
Strategies saved in Python mode run in backtests (delivery and intraday), with the same fills and charges as
visual strategies, inside a sandbox that cannot import modules, reach secrets or run unbounded (D9, D47).

## Read first
- `AGENTS.md` (§8, §10), `docs/DECISIONS.md` (D9, D45, D46, D47), `docs/ARCHITECTURE.md` (Strategies)
- `backend/services/backtest/src/nova_backtest/{simulate,rules,visual}.py`

## Files
Create: `nova_backtest/{sandbox.py,sandbox_runner.py}`, `services/backtest/tests/test_sandbox.py`
Modify: `nova_backtest/{simulate.py,rules.py,visual.py→strategy_engine.py,cli.py}`, `tests/{test_simulate.py,test_visual.py→test_engine.py}`,
`docs/{DECISIONS,STRUCTURE,ARCHITECTURE}.md`

## Build
1. `simulate(..., signals)`: a `Signals` protocol (`enter(symbol, i)`, `exit(symbol, i)`); `RuleSignals` wraps rule groups.
2. API for users: `class Strategy` with `on_bar(self, ctx)` returning `"enter"`, `"exit"` or `None`; `ctx` gives
   `symbol`, `time` (ISO), `open/high/low/close` (rupees), `volume`, `index`, `closes` (so far), `sma(n)`,
   `highest(n)`, `lowest(n)`. A new instance per symbol.
3. `check_code(code)` (AST): refuse imports, `global`/`nonlocal`, any name or attribute starting with `_`, calls to
   eval/exec/compile/open/input/getattr/setattr/delattr/globals/locals/vars/breakpoint/help/type/super; must define
   `Strategy`. Errors name the line.
4. `run_python(code, bars)`: `sys.executable -I sandbox_runner.py`, empty environment, JSON over stdin/stdout,
   CPU 20 s / memory 512 MB / 16 open files on Linux, 30 s wall clock; the runner uses a whitelisted `__builtins__`.
   User exceptions and bad return values become `EngineError` with the line.
5. `StrategyEngine` runs both modes.

## Acceptance checks
- [x] Tests: a Python strategy trades like the equivalent visual one; each AST rule refuses; imports, `__class__`
      escapes and infinite loops fail cleanly; no environment variable is visible inside. `backend-check` passes.

## Out of scope
- Editing/validating code in the editor (059), strategy state across symbols, third-party libraries in the sandbox.

## Handoff
**Done:** Built by Claude on Owner request (2026-09-25). Sandbox (AST check + limited child process), `Signals` protocol,
`StrategyEngine` for both modes.
**Commands run:** `backend-check` pass (331 tests; Linux resource limits active in Docker); 18 sandbox tests incl. a
defence-in-depth test with the AST check disabled.
**New dependencies:** none.
**Deviations:** `math` is preloaded instead of importable; `ctx.closes` is a read-only view.
**Known gaps:** the editor does not pre-check Python code yet (059 can call the same rules).

## Review
**Result:** done
**Security review:** imports, `_` names/attributes, format-string attribute tricks and reflective builtins are refused
before running; the child still has no dangerous builtins, no environment (no DB URL or tokens), CPU/memory/file
limits and a wall-clock timeout; it returns only signals. The container is the outer boundary.
**Fixed directly:** test regexes (escaping), mypy on platform-specific `resource`.
**Rulebook issues found:** none. **Follow-up tasks created:** none.
