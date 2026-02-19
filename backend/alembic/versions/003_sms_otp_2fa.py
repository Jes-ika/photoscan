"""Add phone and SMS OTP for 2FA

Revision ID: 003
Revises: 002
Create Date: 2025-02-18

"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone_number", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("otp_code", sa.String(10), nullable=True))
    op.add_column("users", sa.Column("otp_expires_at", sa.DateTime(), nullable=True))
    op.drop_column("users", "totp_secret")


def downgrade() -> None:
    op.add_column("users", sa.Column("totp_secret", sa.String(32), nullable=True))
    op.drop_column("users", "otp_expires_at")
    op.drop_column("users", "otp_code")
    op.drop_column("users", "phone_number")
