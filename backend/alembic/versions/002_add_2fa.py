"""Add 2FA for organizers

Revision ID: 002
Revises: 001
Create Date: 2025-02-18

"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("totp_enabled", sa.Boolean(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
