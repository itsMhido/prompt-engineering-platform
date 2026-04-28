"""initial schema

Revision ID: eaafb88c8a36
Revises: 
Create Date: 2026-04-28 09:36:22.598707
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'eaafb88c8a36'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("role", sa.String(), server_default=sa.text("'member'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "models",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("model_id", sa.Text(), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("api_key_encrypted", sa.Text(), nullable=False),
        sa.Column("temperature", sa.Float(), server_default=sa.text("0.7"), nullable=False),
        sa.Column("max_tokens", sa.Integer(), server_default=sa.text("1024"), nullable=False),
        sa.Column("top_p", sa.Float(), server_default=sa.text("1.0"), nullable=False),
        sa.Column("stop_sequences", postgresql.ARRAY(sa.String()), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("status", sa.String(), server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "prompts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("tags", postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), server_default=sa.text("'Custom'"), nullable=False),
        sa.Column("version", sa.Text(), server_default=sa.text("'v1'"), nullable=False),
        sa.Column("columns", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "workspace_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(), server_default=sa.text("'member'"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_members_workspace_user"),
    )
    op.create_table(
        "prompt_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prompt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("system_prompt", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("user_template", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("commit_message", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["prompt_id"], ["prompts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("prompt_id", "version_number", name="uq_prompt_versions_prompt_version"),
    )
    op.create_table(
        "dataset_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("row_index", sa.Integer(), nullable=False),
        sa.Column("row_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "experiments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prompt_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("prompt_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("model_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("dataset_row_index", sa.Integer(), nullable=True),
        sa.Column("prompt_name", sa.Text(), nullable=True),
        sa.Column("prompt_version", sa.Text(), nullable=True),
        sa.Column("model_name", sa.Text(), nullable=True),
        sa.Column("provider", sa.Text(), nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("user_template", sa.Text(), nullable=True),
        sa.Column("variable_values", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("interpolated_prompt", sa.Text(), nullable=True),
        sa.Column("output", sa.Text(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        sa.Column("cost_estimate", sa.Float(), server_default=sa.text("0"), nullable=False),
        sa.Column("status", sa.Text(), server_default=sa.text("'success'"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("scores", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("reasoning", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("tags", postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("notes", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"]),
        sa.ForeignKeyConstraint(["model_id"], ["models.id"]),
        sa.ForeignKeyConstraint(["prompt_id"], ["prompts.id"]),
        sa.ForeignKeyConstraint(["prompt_version_id"], ["prompt_versions.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("experiments")
    op.drop_table("dataset_rows")
    op.drop_table("prompt_versions")
    op.drop_table("workspace_members")
    op.drop_table("datasets")
    op.drop_table("prompts")
    op.drop_table("models")
    op.drop_table("workspaces")
    op.drop_table("users")
