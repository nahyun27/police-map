"""anonymous case empathy (public_case_empathies.ip_hash, user_id nullable)

Revision ID: e4c1a9d07b26
Revises: d2b6f8a14e73
Create Date: 2026-10-24 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e4c1a9d07b26'
down_revision: Union[str, None] = 'd2b6f8a14e73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('public_case_empathies') as b:
        b.alter_column('user_id', existing_type=sa.Integer(), nullable=True)
        b.add_column(sa.Column('ip_hash', sa.String(length=32), nullable=True))
        b.create_index('ix_public_case_empathies_ip_hash', ['ip_hash'])
        b.create_unique_constraint('uq_public_case_empathies_case_ip', ['case_id', 'ip_hash'])


def downgrade() -> None:
    op.execute("DELETE FROM public_case_empathies WHERE user_id IS NULL")
    with op.batch_alter_table('public_case_empathies') as b:
        b.drop_constraint('uq_public_case_empathies_case_ip', type_='unique')
        b.drop_index('ix_public_case_empathies_ip_hash')
        b.drop_column('ip_hash')
        b.alter_column('user_id', existing_type=sa.Integer(), nullable=False)
