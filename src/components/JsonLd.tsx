/** 검색엔진용 구조화 데이터(schema.org JSON-LD). 화면에는 보이지 않는다.
 * JSON 안의 "</script>" 같은 문자열이 스크립트를 끝내지 못하게 "<" 를 이스케이프한다. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- 서버에서 만든 객체를 직렬화한 값만 넣는다
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
