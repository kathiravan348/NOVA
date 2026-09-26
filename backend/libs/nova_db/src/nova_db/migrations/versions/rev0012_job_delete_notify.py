"""Deleting a data job is announced on `nova_events` too (NOVA-095, D57).

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-26
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOTIFY_BOTH = """
CREATE OR REPLACE FUNCTION nova_notify_data_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM pg_notify(
            'nova_events', json_build_object('type', 'data_job.deleted', 'id', OLD.id)::text
        );
        RETURN OLD;
    END IF;
    PERFORM pg_notify(
        'nova_events', json_build_object('type', 'data_job.updated', 'id', NEW.id)::text
    );
    RETURN NEW;
END
$$
"""

NOTIFY_UPDATES = """
CREATE OR REPLACE FUNCTION nova_notify_data_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify(
        'nova_events',
        json_build_object('type', 'data_job.updated', 'id', NEW.id)::text
    );
    RETURN NEW;
END
$$
"""


def upgrade() -> None:
    op.execute(NOTIFY_BOTH)
    op.execute("DROP TRIGGER data_jobs_notify ON data_jobs")
    op.execute(
        "CREATE TRIGGER data_jobs_notify AFTER INSERT OR UPDATE OR DELETE ON data_jobs"
        " FOR EACH ROW EXECUTE FUNCTION nova_notify_data_job()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER data_jobs_notify ON data_jobs")
    op.execute(
        "CREATE TRIGGER data_jobs_notify AFTER INSERT OR UPDATE ON data_jobs"
        " FOR EACH ROW EXECUTE FUNCTION nova_notify_data_job()"
    )
    op.execute(NOTIFY_UPDATES)
