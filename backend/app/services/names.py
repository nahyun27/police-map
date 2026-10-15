"""수사관 이름 일부 가림(2026-10 의뢰인 결정). 이용자가 입력한 실명은 DB 에 그대로 두고(관리자만 열람),
공개 화면에는 항상 가린 이름만 내보낸다: 김철수 → 김*수, 이준 → 이*, 남궁민수 → 남**수."""
import re


def mask_name(name: str) -> str:
    n = name.strip()
    if len(n) <= 1:
        return n
    if len(n) == 2:
        return n[0] + "*"
    return n[0] + "*" * (len(n) - 2) + n[-1]


def mask_in_text(text: str, name: str) -> str:
    """본문에 같은 실명을 적었으면 그 부분도 가린다 — 이름 칸만 가리고 본문에 실명이 남으면 소용없다."""
    n = re.sub(r"\s+", "", name)
    if len(n) < 2 or not text:
        return text
    # "김철수", "김 철수", "김  철 수"처럼 글자 사이에 공백이 섞인 형태도 같은 이름으로 본다.
    pattern = r"\s*".join(re.escape(ch) for ch in n)
    return re.sub(pattern, mask_name(n), text)
