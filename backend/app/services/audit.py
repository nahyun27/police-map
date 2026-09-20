from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog


def log_action(
    db: Session, actor_id: int | None, action: str, target_type: str, target_id: int | None, detail: dict[str, Any] | None = None
) -> None:
    """감사 로그를 추가한다(커밋은 호출자가 한다 — 조치와 같은 트랜잭션에 묶기 위해)."""
    db.add(AuditLog(actor_id=actor_id, action=action, target_type=target_type, target_id=target_id, detail=detail))
