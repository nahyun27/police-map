"""평가(리뷰)·게시판 글에 공통으로 쓰는 추천/비추천 집계 + 댓글 트리 변환.

ReviewVote/PostVote, ReviewComment/PostComment 는 대상 FK 이름만 다를 뿐 구조가 완전히
같아서(값/작성자/부모-자식), 집계·트리 변환 로직을 여기서 공유한다."""
from sqlalchemy import case, func, select
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.models import ReviewReply, User
from app.schemas.community import CommentOut, VoteSummary

REMOVED_BODY = "삭제된 댓글입니다."


def vote_summaries(
    db: Session, vote_model, fk_col: InstrumentedAttribute, target_ids: list[int], user_id: int | None,
) -> dict[int, VoteSummary]:
    result = {tid: VoteSummary(up=0, down=0, score=0, my_vote=0) for tid in target_ids}
    if not target_ids:
        return result
    up = func.sum(case((vote_model.value == 1, 1), else_=0))
    down = func.sum(case((vote_model.value == -1, 1), else_=0))
    for tid, u, d in db.execute(select(fk_col, up, down).where(fk_col.in_(target_ids)).group_by(fk_col)).all():
        u, d = int(u or 0), int(d or 0)
        result[tid] = VoteSummary(up=u, down=d, score=u - d, my_vote=0)
    if user_id is not None:
        mine = db.execute(select(fk_col, vote_model.value).where(fk_col.in_(target_ids), vote_model.user_id == user_id)).all()
        for tid, v in mine:
            result[tid].my_vote = v
    return result


def scrapped_set(
    db: Session, scrap_model, fk_col: InstrumentedAttribute, target_ids: list[int], user_id: int | None,
) -> set[int]:
    """target_ids 중 user_id 가 스크랩한 것들의 id 집합. 비로그인이면 항상 빈 집합."""
    if not target_ids or user_id is None:
        return set()
    rows = db.execute(select(fk_col).where(fk_col.in_(target_ids), scrap_model.user_id == user_id)).all()
    return {r[0] for r in rows}


def comment_counts(db: Session, comment_model, fk_col: InstrumentedAttribute, target_ids: list[int]) -> dict[int, int]:
    """댓글 수(소프트 삭제된 것 포함 — 화면에 "삭제된 댓글입니다" 자리로 그대로 보이므로)."""
    if not target_ids:
        return {}
    counts = dict(db.execute(select(fk_col, func.count(comment_model.id)).where(fk_col.in_(target_ids)).group_by(fk_col)).all())
    return {tid: int(counts.get(tid, 0)) for tid in target_ids}


def reply_rows(db: Session, review_ids: list[int]) -> dict[int, tuple[ReviewReply, User | None]]:
    """review_id → (해명, 작성자). 삭제는 하드 삭제라 여기 조회되면 곧 "현재 유효한" 해명이다.
    작성자를 outer join 하는 이유는 인증이 사후 해제돼도(User.officer_* 가 비어도) 해명 행
    자체는 남기 때문(User 는 계정 삭제 기능이 없어 사실상 항상 존재하지만 방어적으로 outer join)."""
    if not review_ids:
        return {}
    rows = db.execute(
        select(ReviewReply, User).outerjoin(User, User.id == ReviewReply.author_id)
        .where(ReviewReply.review_id.in_(review_ids))
    ).all()
    return {r.review_id: (r, u) for r, u in rows}


_EMPTY_VOTE = VoteSummary(up=0, down=0, score=0, my_vote=0)


def comment_tree(
    rows: list[tuple], user_id: int | None, votes: dict[int, VoteSummary] | None = None, sort: str = "new",
) -> list[CommentOut]:
    """rows: (댓글 ORM 객체, 작성자 닉네임) 튜플 목록, created_at 오름차순으로 전달해야
    대댓글이 부모보다 먼저 뜨지 않는다(부모가 아직 안 들어왔으면 임시로 최상위 취급됨).
    sort="top" 이면 최상위 댓글만 추천순으로 재정렬한다(대댓글은 항상 시간순 유지 —
    하나의 대화 흐름이라 순서를 흔들면 맥락이 깨진다)."""
    votes = votes or {}
    by_id: dict[int, CommentOut] = {}
    roots: list[CommentOut] = []
    for c, nickname in rows:
        vote = votes.get(c.id, _EMPTY_VOTE)
        node = CommentOut(
            id=c.id, author_nickname=nickname, body=REMOVED_BODY if c.is_removed else c.body,
            is_removed=c.is_removed, is_mine=(user_id is not None and c.author_id == user_id),
            parent_id=c.parent_id, score=vote.score, my_vote=vote.my_vote,
            created_at=c.created_at.isoformat() if c.created_at else None,
            removed_at=c.removed_at.isoformat() if c.removed_at else None, replies=[],
        )
        by_id[c.id] = node
        if c.parent_id and c.parent_id in by_id:
            by_id[c.parent_id].replies.append(node)
        else:
            roots.append(node)
    if sort == "top":
        roots.sort(key=lambda n: n.score, reverse=True)
    return roots
