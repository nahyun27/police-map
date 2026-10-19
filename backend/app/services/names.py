"""수사관 이름 일부 가림(2026-10 의뢰인 결정). 이용자가 입력한 실명은 DB 에 그대로 두고(관리자만 열람),
공개 화면에는 항상 가린 이름만 내보낸다: 김철수 → 김*수, 이준 → 이*, 남궁민수 → 남**수."""
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

# 계급은 정해진 값만 받는다. 자유 입력이면 "김철수경위"처럼 계급 칸에 실명을 적어 가림을 우회할 수 있었다
# (2026-10 출시 전 보안 점검). 작성 화면(WriteForm RANK_OPTIONS)과 같은 목록.
OFFICER_RANKS = ("순경", "경장", "경사", "경위", "경감", "경정", "총경")

# 글자 사이에 끼워 넣어 가림을 피하는 문자들: 공백, 점·하이픈 같은 기호, 폭 없는 공백(U+200B~U+200D, U+FEFF).
# 한글은 \w 에 속하므로 [\W_] 는 한글을 건너뛰지 않는다.
_GAP = r"[\W_]*"


def mask_name(name: str) -> str:
    n = name.strip()
    if len(n) <= 1:
        return n
    if len(n) == 2:
        return n[0] + "*"
    return n[0] + "*" * (len(n) - 2) + n[-1]


def mask_in_text(text: str, name: str) -> str:
    """본문에 같은 실명을 적었으면 그 부분도 가린다. 이름 칸만 가리고 본문에 실명이 남으면 소용없다."""
    n = re.sub(r"[\W_]+", "", name)
    if len(n) < 2 or not text:
        return text
    # "김철수", "김 철수", "김.철.수", 글자 사이에 폭 없는 공백을 넣은 형태도 같은 이름으로 본다.
    pattern = _GAP.join(re.escape(ch) for ch in n)
    return re.sub(pattern, mask_name(n), text)


def mask_station_officers(db: Session, station_id: int | None, *texts: str | None) -> list[str | None]:
    """그 경찰서에 등록된 모든 수사관(비공개 처리된 사람 포함) 이름을 글에서 가린다.

    평가 대상 수사관 이름만 가리면, 경찰서 전체 평가 본문이나 댓글("최지훈 수사관 맞습니다")로
    다른 사람이 실명을 다시 적어 가림을 무력화할 수 있었다(2026-10 출시 전 보안 점검)."""
    if station_id is None or not any(texts):
        return list(texts)
    from app.models import Officer  # 순환 import 방지

    names = sorted(set(db.scalars(select(Officer.name).where(Officer.station_id == station_id))), key=len, reverse=True)
    out: list[str | None] = []
    for t in texts:
        if t:
            for n in names:
                t = mask_in_text(t, n)
        out.append(t)
    return out
