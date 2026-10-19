"""retention timestamps (users.deleted_at, ad_inquiries.done_at)

Revision ID: a3f9c2e17d55
Revises: 7c1e2a9d4b10
Create Date: 2026-10-19 21:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f9c2e17d55'
down_revision: Union[str, None] = '7c1e2a9d4b10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('ad_inquiries', sa.Column('done_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('ad_inquiries', 'done_at')
    op.drop_column('users', 'deleted_at')
