"""Add access_code to events

Revision ID: 004
Revises: 003
Create Date: 2025-02-18

"""
import random
import string
from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def _gen_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def upgrade() -> None:
    op.add_column("events", sa.Column("access_code", sa.String(16), nullable=True))
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT id FROM events WHERE access_code IS NULL"))
    for (eid,) in result:
        code = _gen_code()
        conn.execute(sa.text("UPDATE events SET access_code = :c WHERE id = :i"), {"c": code, "i": eid})
    op.create_index("ix_events_access_code", "events", ["access_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_events_access_code", table_name="events")
    op.drop_column("events", "access_code")
