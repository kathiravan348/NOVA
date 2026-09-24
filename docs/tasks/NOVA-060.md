# NOVA-060 — Dev machine rules: fnm + pnpm, uv, Docker Desktop limits

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-060 · **Depends on:** —

## Goal
The rulebook matches the Owner's rebuilt PC (setup guide 2026-09-24): Node via fnm, pnpm only, Python via
uv only, Docker Desktop capped by `.wslconfig`. Agents know which commands to use and which never to use.

## Read first
- `AGENTS.md` (§4, §5, §8), `docs/DECISIONS.md` (D30, D33)

## Files
Modify: `AGENTS.md` (new §5a), `docs/DECISIONS.md` (D36), `README.md` (prerequisites), `START-HERE.md` (step 2),
`.claude/launch.json` (app configs through `fnm exec`)

## Build
1. AGENTS §5a: machine facts (RAM/CPU caps, drives), tool rules (pnpm/uv only, banned commands), how to get
   Node in a non-interactive shell, Docker hygiene (localhost ports, memory limits, `down` after use).
2. D36: amends D33 — host uv allowed for fast, package-scoped backend checks and editors; Docker stays the gate.
3. README / START-HERE: install steps via winget + fnm + pnpm + uv; drop `npm i -g pnpm`.
4. `launch.json`: `nova-orbit` / `nova-relay` start via `fnm exec --using=24 -- pnpm …` (the old
   `C:\Program Files\nodejs\node.exe` path no longer exists).

## Acceptance checks
- [x] `fnm exec --using=24 -- pnpm --version` → 12.x from a non-interactive PowerShell.
- [x] `uv --version`, `docker compose version` work; `uv cache dir` = `E:\caches\uv`.
- [x] Docs only + launch config; no code change.

## Out of scope
- Moving the repo to `E:\projects` (Owner decision), editor settings, Ollama.

## Handoff
**Done:** Built by Claude on Owner request (2026-09-24). Docs + launch config only.
**Commands run:** tool version checks above → all pass.

## Review
**Result:** done (Claude planning task; docs only).
