"""user suspension (users.suspended_at, users.suspend_reason)

Revision ID: b81d4e6a2c90
Revises: a3f9c2e17d55
Create Date: 2026-10-20 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b81d4e6a2c90'
down_revision: Union[str, None] = 'a3f9c2e17d55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('suspended_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('suspend_reason', sa.String(length=300), nullable=True))
    # 탈퇴 시각(deleted_at) 기록 이전에 탈퇴한 회원은 상태가 "정상"으로 보이므로 채워 넣는다. 정확한 탈퇴 시각은 남아
    # 있지 않아 이 마이그레이션 시각으로 둔다(1년 보관 기간은 지금부터 센다, 짧게 잡히는 쪽이 아니라 안전).
    op.execute(
        "UPDATE users SET deleted_at = CURRENT_TIMESTAMP "
        "WHERE deleted_at IS NULL AND is_active = false AND email LIKE 'deleted-user-%@policemap.invalid'"
    )


def downgrade() -> None:
    op.drop_column('users', 'suspend_reason')
    op.drop_column('users', 'suspended_at')
