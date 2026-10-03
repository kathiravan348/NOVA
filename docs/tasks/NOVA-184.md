# NOVA-184 — Backtest service: research profiles table + endpoints, freeze + hash (D84, migration 0032)

**Status:** done · **Owner:** Claude · **Branch:** task/NOVA-184 · **Depends on:** NOVA-181, NOVA-182

## Goal
The `/research-profiles` endpoints of NOVA-182 work on the real backend: profiles and versions are stored, a draft
can change, a frozen version never changes and carries a SHA-256 hash of its settings. Orbit's real mode can use
them as soon as NOVA-194 adds the page.

## Read first
- `AGENTS.md` §1 (D76), §7a, §8; `docs/DECISIONS.md` D67, D84; `docs/tasks/NOVA-182.md` Build 5 (endpoints, errors)
- `backend/libs/nova_contracts/src/nova_contracts/research_profile.py`; `backend/services/backtest/src/nova_backtest/routes.py`, `main.py`

## Files
Create:
- `backend/libs/nova_db/src/nova_db/migrations/versions/rev0032_research_profiles.py`
- `backend/services/backtest/src/nova_backtest/profiles.py`, `backend/services/backtest/tests/test_profiles.py`
Modify:
- `backend/libs/nova_db/src/nova_db/models/backtest.py`, `models/__init__.py`, `backend/libs/nova_db/tests/test_migrations.py`
- `backend/services/backtest/src/nova_backtest/main.py` (include the router)
- `backend/services/core/src/nova_core/gateway.py` (`ROUTES["research-profiles"] = "backtest_url"`),
  `agent_rules.py` (`"research-profiles": "held"`), `backend/services/core/tests/test_agent_rules.py`, `test_agent_gateway.py`
- `docs/guides/API.md`, `docs/guides/DATABASE.md`

## Build
1. Migration 0032: `research_profiles` (`id` PK, `name` 1–80, `description`, `created_at`, `updated_at`) and
   `research_profile_versions` (PK `profile_id` → research_profiles cascade + `version` ≥ 1, `note`, `settings`
   jsonb, `frozen` bool, `hash` char(64) null, `created_at`, `frozen_at` null; check: `frozen = (hash IS NOT NULL)
   = (frozen_at IS NOT NULL)`). No new audit action or target type: writes use `settings.update`, target
   `settings` / `research-profile/<id>` (as the recorder does), e.g. "Research profile Intraday v1: v2 frozen".
2. `profiles.py` router, exactly the NOVA-182 contract: list (newest updated first), create (version 1 draft),
   get, add version (next number, draft, copies nothing), update draft settings (400 `Frozen versions cannot
   change`), freeze (400 `Version is already frozen`), 404 `Research profile not found` / `…version not found`.
   Every write is audited and validated with the Pydantic models (cross-field rules included).
3. Hash = SHA-256 hex of the settings dumped `by_alias`, `sort_keys=True`, separators `(",", ":")`, floats as
   Python `repr` (document this in `API.md`). A test pins the default settings' hash value.
4. `get_frozen_settings(db, profile_id, version) -> ResearchSettings` helper for NOVA-185 (raises `EngineError` with
   a plain message when missing or not frozen).

## Acceptance checks
- [ ] API tests mirror the NOVA-182 handler tests (create, version, update draft, frozen → 400, freeze twice → 400, 404s) + audit rows.
- [ ] Hash test: same settings → same hash; any change → different hash; key order in the body does not matter.
- [ ] Gateway: `/api/v1/research-profiles` reaches the backtest service; agent writes are held (D67).
- [ ] Migration round trip; `docker compose run --rm backend-check` passes.

## Out of scope
- Any screen (NOVA-194). Using profiles in runs (NOVA-185). Deleting profiles.
- Deploy after 15:45 IST or at a weekend (D76): migrate, then `backtest backtest-worker core` with `--no-deps`.

## Questions
_(implementer writes here if blocked)_

## Handoff
**Done:** migration 0032 (`research_profiles`, `research_profile_versions`), `/research-profiles` router (list, create,
get, add version, update draft, freeze with SHA-256 hash), audit rows, gateway route + held agent writes, `get_frozen_settings`.
**Files changed:** the listed files, plus `nova_core/api_docs.py` (research-profiles tagged under Backtests) and
`core/tests/test_api_docs.py` (the "not available" line names both prefixes of the backtest service).
**Commands run:** `docker compose run --rm backend-check` pass (1,546 tests). No frontend change.
**New dependencies:** none. **Maps updated:** none. **Guides updated:** API, DATABASE.
**Deviations from task:** hash check is `frozen = (hash IS NOT NULL) AND frozen = (frozen_at IS NOT NULL)` (same meaning,
valid SQL); names are trimmed and limited to 80 characters in the API (400) as well as the DB check; ids `rp_…`.
Pinned hash of the default settings: `b206dcab…2cf0` (`test_profiles.py`).
**Known gaps:** the mock profile's hash (`aaa…`) is a placeholder, not the real hash of its settings.

## Review
**Result:** done
**Reviewer / built by:** Claude / Claude. **Self-review:** yes (Owner asked for self-review, 4 Oct 2026; same session).
**Fixed directly (review: commits):** none needed; checked the diff against NOVA-182 Build 5 (paths, messages, 201s).
**Change requests:** none.
**Guides checked:** API (new section, gateway diagram) and DATABASE (0032, map, two tables) match the diff.
**Rulebook issues found:** none. Migration and `backtest backtest-worker core` deploy wait for a quiet time (D76).
**Follow-up tasks created:** none.
