"""page_views (self-hosted visit stats)

Revision ID: c5a7e0b93f12
Revises: b81d4e6a2c90
Create Date: 2026-10-20 19:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5a7e0b93f12'
down_revision: Union[str, None] = 'b81d4e6a2c90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'page_views',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('path', sa.String(length=300), nullable=False),
        sa.Column('referrer_host', sa.String(length=120), nullable=True),
        sa.Column('visitor_hash', sa.String(length=32), nullable=False),
        sa.Column('device', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_page_views_day', 'page_views', ['day'])
    op.create_index('ix_page_views_path', 'page_views', ['path'])
    op.create_index('ix_page_views_day_visitor', 'page_views', ['day', 'visitor_hash'])


def downgrade() -> None:
    op.drop_index('ix_page_views_day_visitor', table_name='page_views')
    op.drop_index('ix_page_views_path', table_name='page_views')
    op.drop_index('ix_page_views_day', table_name='page_views')
    op.drop_table('page_views')
