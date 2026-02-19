"""Initial schema

Revision ID: 001
Revises:
Create Date: 2025-02-18

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("organizer", "student", "admin"), server_default="student"),
        sa.Column("is_active", sa.Boolean(), server_default="1"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("face_encoding", sa.JSON(), nullable=True),
        sa.Column("face_photo_url", sa.String(500), nullable=True),
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("event_date", sa.DateTime(), nullable=True),
        sa.Column("status", sa.Enum("draft", "published", "processing", "archived"), server_default="draft"),
        sa.Column("cover_image_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("organizer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "event_photos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("thumbnail_path", sa.String(500), nullable=True),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("face_encodings", sa.JSON(), nullable=True),
        sa.Column("face_count", sa.Integer(), server_default="0"),
        sa.Column("processing_status", sa.String(50), server_default="pending"),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        mysql_charset="utf8mb4",
    )

    op.create_table(
        "face_searches",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id"), nullable=True),
        sa.Column("match_count", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        mysql_charset="utf8mb4",
    )


def downgrade() -> None:
    op.drop_table("face_searches")
    op.drop_table("event_photos")
    op.drop_table("events")
    op.drop_table("users")
