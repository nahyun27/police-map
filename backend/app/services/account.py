"""회원 탈퇴 처리.

User 행은 하드 삭제하지 않고 비활성화(soft delete)한다 — users.id 를 참조하는 테이블이
많아 연쇄 삭제가 복잡하기도 하지만, 더 중요한 이유는 이 서비스의 핵심 가치(공익 목적의
수사기관 평가 기록)다: 작성자가 탈퇴해도 평가·게시글 자체는 남아야 하므로, 로그인 없이
쓴 글과 동일하게 author_id 를 비워 "익명"으로 전환해 공개 기록은 보존한다."""
import secrets

from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    Post, PostComment, PostCommentVote, PostScrap, PostVote, RegionFollow, Review, ReviewComment,
    ReviewCommentVote, ReviewScrap, ReviewVote, User,
)


def delete_account(db: Session, user: User) -> None:
    uid = user.id

    # 평가·게시글·댓글은 지우지 않고 작성자만 떼어낸다(비로그인 작성과 동일하게 "익명" 표시,
    # ANON_LABEL 로 화면에 뜬다).
    db.execute(update(Review).where(Review.author_id == uid).values(author_id=None))
    db.execute(update(Post).where(Post.author_id == uid).values(author_id=None))
    db.execute(update(ReviewComment).where(ReviewComment.author_id == uid).values(author_id=None))
    db.execute(update(PostComment).where(PostComment.author_id == uid).values(author_id=None))

    # 추천/비추천은 익명 투표(ip_hash)로 옮겨 줄 원본 IP를 모르므로 그냥 지운다 — 과거 투표
    # 몇 개가 집계에서 빠지는 건 탈퇴의 자연스러운 결과로 본다.
    db.execute(delete(ReviewVote).where(ReviewVote.user_id == uid))
    db.execute(delete(ReviewCommentVote).where(ReviewCommentVote.user_id == uid))
    db.execute(delete(PostVote).where(PostVote.user_id == uid))
    db.execute(delete(PostCommentVote).where(PostCommentVote.user_id == uid))

    # 스크랩·관심 지역은 순수 개인 설정이라 공개 기록으로 남길 이유가 없다.
    db.execute(delete(ReviewScrap).where(ReviewScrap.user_id == uid))
    db.execute(delete(PostScrap).where(PostScrap.user_id == uid))
    db.execute(delete(RegionFollow).where(RegionFollow.user_id == uid))

    # 제보(Report)·경찰관 인증 이력(OfficerVerification)·해명(ReviewReply)·감사 로그는 건드리지
    # 않는다 — 전부 "누가 했는지"가 기록 자체의 의미인 데이터라서, 탈퇴로 지워지면 악용
    # 소지(신고·해명 후 탈퇴로 책임 회피 등)가 있고 감사 로그는 원래 수정하지 않는 게 원칙이다.
    # 계정 쪽만 비활성화·익명화한다(아래). ReviewReply 는 author 가 남아 있지만 officer_*
    # 필드가 전부 비워지므로 reply_out() 이 "경찰관(인증 해제됨)"이 아닌 일반 "경찰관" 라벨로
    # 내려준다(해당 함수 로직 참고) — 신원 세부사항만 거둬들이고 해명 내용 자체는 남긴다.

    # 계정 자체는 하드 삭제하지 않고 비활성화 + 개인정보만 지운다. email 은 고유 제약이 걸려
    # 있어 그대로 두면 같은 이메일로 재가입을 영영 못 하므로 더미 값으로 바꾼다. 비밀번호도
    # 추측 불가능한 값으로 덮어써서, is_active 검사가 어딘가 빠지더라도 로그인 자체가 막히게
    # 이중으로 막아 둔다.
    user.is_active = False
    user.email = f"deleted-user-{uid}@policemap.invalid"
    user.nickname = "탈퇴한 회원"
    user.password_hash = hash_password(secrets.token_urlsafe(32))
    user.officer_station_id = None
    user.officer_name = None
    user.officer_rank = None
    user.officer_department = None
    user.officer_verified_at = None
    db.commit()
