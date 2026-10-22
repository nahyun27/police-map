"""station kind (경찰서 / 시·도경찰청 / 본청) and search alias

Revision ID: d2b6f8a14e73
Revises: c5a7e0b93f12
Create Date: 2026-10-22 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2b6f8a14e73'
down_revision: Union[str, None] = 'c5a7e0b93f12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('stations', sa.Column('kind', sa.String(length=20), server_default='station', nullable=False))
    op.add_column('stations', sa.Column('search_alias', sa.String(length=100), nullable=True))
    op.create_index('ix_stations_kind', 'stations', ['kind'])


def downgrade() -> None:
    op.drop_index('ix_stations_kind', table_name='stations')
    op.drop_column('stations', 'search_alias')
    op.drop_column('stations', 'kind')
