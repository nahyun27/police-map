"""사이트맵의 모든 주소를 IndexNow 로 한 번에 알린다(처음 연결할 때·대량 변경 뒤 수동 실행).
사용법(서버): cd ~/police-map/backend && venv/bin/python -m scripts.indexnow_submit_all
"""
import re
import urllib.request

from app.services import indexnow


def main() -> None:
    if not indexnow.enabled():
        print("IndexNow 비활성(개발·테스트 환경이거나 키 없음). 보내지 않았습니다.")
        return
    with urllib.request.urlopen(indexnow.site_url("/sitemap.xml"), timeout=30) as res:
        urls = re.findall(r"<loc>([^<]+)</loc>", res.read().decode())
    print(f"사이트맵 주소 {len(urls)}개를 알립니다.")
    for endpoint, code in indexnow.submit(urls).items():
        print(f"  {endpoint}: {code}")


if __name__ == "__main__":
    main()
