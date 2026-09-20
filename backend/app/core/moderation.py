"""게시 불가 표현 검사 — 서버 측 최종 관문.

프론트(src/data/sample.ts 의 BANNED)에도 같은 목록이 있으나 프론트 검사는 UX 용이고,
우회가 가능하므로 서버에서 반드시 다시 검사한다.

주의: '개' 처럼 짧은 한 글자는 '3개월', '개인' 등 정상 문장에 대량 오탐되므로 넣지 않는다.
단순 포함 검사의 한계가 있어, 실서비스에서는 형태소 분석/외부 필터와 사람 검수를 함께 쓴다.
"""

BANNED_EXPRESSIONS = ["쓰레기", "무능", "멍청", "새끼", "미친", "병신", "죽어"]


def find_banned(text: str) -> list[str]:
    return [w for w in BANNED_EXPRESSIONS if w in text]
