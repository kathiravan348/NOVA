# NOVA starter pack — how to begin

1. Create a private GitHub repo named `nova` and copy this whole folder into it. Commit to `main`.
2. Install on Windows (winget): Git, fnm + Node 24, pnpm, uv, Docker Desktop (WSL2). Tool rules: `AGENTS.md` §5a.
3. **Claude Code:** open the repo folder. It reads `CLAUDE.md` automatically (which points to `AGENTS.md`).
4. **Antigravity:** open the same repo folder and add a workspace rule that says: "Follow `GEMINI.md` and `AGENTS.md` in the repo root." (If your Antigravity version reads `GEMINI.md` or `AGENTS.md` automatically, this step is already covered.)
5. First run:
   - Gemini: "Start the next task." → it picks NOVA-001 from `docs/tasks/BOARD.md`.
   - Claude, at the same time: "Plan the next tasks." → it writes NOVA-002 and NOVA-004 (lanes A and B).
6. When Gemini sets NOVA-001 to `ready-for-review`, tell Claude: "Review ready tasks."

Reviewing Stage A: see `docs/REVIEW-GUIDE.md` (`cd frontend && pnpm review`).

Design reference: NOVA Style design system (tokens already copied to `frontend/packages/ui-core/src/theme/tokens.json`).
You can delete this file after setup.
