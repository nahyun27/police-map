"""신고 대상(5종류: 평가/게시판 글/평가 댓글/게시판 댓글/해명) 조회·조치 공통 로직.

Report.target_type 에 따라 어떤 테이블을 볼지 결정한다. Report 모델 자체는 FK 가 없는
target_id 만 가지므로(app/models/report.py 의 docstring 참고), 여기서 매번 애플리케이션
레벨로 대상 존재 여부를 확인한다."""
from sqlalchemy.orm import Session

from app.models import Post, PostComment, ReportTarget, Review, ReviewComment, ReviewReply, ReviewStatus
from app.services import takedown as takedown_svc

TARGET_MODEL = {
    ReportTarget.review: Review,
    ReportTarget.post: Post,
    ReportTarget.review_comment: ReviewComment,
    ReportTarget.post_comment: PostComment,
    ReportTarget.review_reply: ReviewReply,
}

_REMOVABLE_REVIEW_STATUSES = (ReviewStatus.published, ReviewStatus.blinded)


def get_target(db: Session, target_type: ReportTarget, target_id: int):
    return db.get(TARGET_MODEL[target_type], target_id)


def target_preview(db: Session, target_type: ReportTarget, target_id: int) -> str:
    obj = get_target(db, target_type, target_id)
    if not obj:
        return "(대상이 이미 삭제됨)"
    if target_type == ReportTarget.post:
        return obj.title
    return (obj.body or "")[:80]


def remove_target(db: Session, target_type: ReportTarget, target_id: int, admin_id: int) -> bool:
    """신고 조치로 대상을 지운다. 콘텐츠 타입마다 이미 쓰고 있는 삭제 방식을 그대로 따른다
    (평가는 상태 전환, 게시판 글·댓글은 소프트 삭제, 해명은 하드 삭제 — 각 모델 docstring 참고).
    대상이 없거나 이미 지워진 상태면 False(관리자는 이 경우 그냥 "기각"으로 처리하면 된다)."""
    obj = get_target(db, target_type, target_id)
    if not obj:
        return False
    if target_type == ReportTarget.review:
        if obj.status not in _REMOVABLE_REVIEW_STATUSES:
            return False
        obj.status, obj.reviewed_by, obj.reviewed_at = ReviewStatus.removed, admin_id, takedown_svc.utcnow()
        obj.reject_reason = "이용자 신고에 따른 조치"
    elif target_type == ReportTarget.post:
        if obj.is_removed:
            return False
        obj.is_removed = True
    elif target_type in (ReportTarget.review_comment, ReportTarget.post_comment):
        if obj.is_removed:
            return False
        obj.is_removed = True
    elif target_type == ReportTarget.review_reply:
        db.delete(obj)
    return True
