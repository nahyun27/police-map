"""add role_other and case_type_other free text columns

Revision ID: e39002633eb6
Revises: 3d2959660ef2
Create Date: 2026-10-13 15:24:56.453745
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e39002633eb6'
down_revision: Union[str, None] = '3d2959660ef2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('reviews', sa.Column('role_other', sa.String(length=40), nullable=True))
    op.add_column('reviews', sa.Column('case_type_other', sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column('reviews', 'case_type_other')
    op.drop_column('reviews', 'role_other')
