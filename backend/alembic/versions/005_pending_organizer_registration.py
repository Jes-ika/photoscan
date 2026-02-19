"""Add pending_organizer_registrations table for OTP-at-registration

Revision ID: 005
Revises: 004
Create Date: 2025-02-18

"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pending_organizer_registrations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("phone_number", sa.String(20), nullable=False),
        sa.Column("otp_code", sa.String(10), nullable=False),
        sa.Column("otp_expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pending_organizer_registrations_email"), "pending_organizer_registrations", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_pending_organizer_registrations_email"), table_name="pending_organizer_registrations")
    op.drop_table("pending_organizer_registrations")
