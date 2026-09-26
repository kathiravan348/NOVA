"""Every data-job change is announced on `nova_events` for NOVA Core's WebSocket (D57).

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-26
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Only the id travels: NOTIFY payloads are limited to 8,000 bytes. Postgres sends identical
    # notices of one transaction once.
    op.execute(
        """
        CREATE FUNCTION nova_notify_data_job() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            PERFORM pg_notify(
                'nova_events',
                json_build_object('type', 'data_job.updated', 'id', NEW.id)::text
            );
            RETURN NEW;
        END
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER data_jobs_notify AFTER INSERT OR UPDATE ON data_jobs"
        " FOR EACH ROW EXECUTE FUNCTION nova_notify_data_job()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER data_jobs_notify ON data_jobs")
    op.execute("DROP FUNCTION nova_notify_data_job()")
