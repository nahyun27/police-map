"""user terms consent

Revision ID: 7c1e2a9d4b10
Revises: 00d3171c3ade
Create Date: 2026-10-19 18:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7c1e2a9d4b10'
down_revision: Union[str, None] = '00d3171c3ade'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('terms_agreed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('terms_version', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'terms_version')
    op.drop_column('users', 'terms_agreed_at')
