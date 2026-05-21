"""add experiment batch fields

Revision ID: f8d27a9153c4
Revises: eaafb88c8a36
Create Date: 2026-05-21 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f8d27a9153c4"
down_revision: Union[str, Sequence[str], None] = "eaafb88c8a36"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("experiments")}
    indexes = {index["name"] for index in inspector.get_indexes("experiments")}

    if "batch_id" not in columns:
        op.add_column("experiments", sa.Column("batch_id", sa.Text(), nullable=True))
    if "batch_name" not in columns:
        op.add_column("experiments", sa.Column("batch_name", sa.Text(), nullable=True))
    if "ix_experiments_batch_id" not in indexes:
        op.create_index("ix_experiments_batch_id", "experiments", ["batch_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("experiments")}
    indexes = {index["name"] for index in inspector.get_indexes("experiments")}

    if "ix_experiments_batch_id" in indexes:
        op.drop_index("ix_experiments_batch_id", table_name="experiments")
    if "batch_name" in columns:
        op.drop_column("experiments", "batch_name")
    if "batch_id" in columns:
        op.drop_column("experiments", "batch_id")
