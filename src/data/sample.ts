/* 샘플 데이터 — 전부 가상. 실서비스에서는 API로 대체 */
import type { Officer, Region, Remedy, Review, Station } from './types';

export const REGIONS: Region[] = [
  { id: 'seoul', name: '서울', full: '서울경찰청', stations: 31 },
  { id: 'busan', name: '부산', full: '부산경찰청', stations: 15 },
  { id: 'daegu', name: '대구', full: '대구경찰청', stations: 11 },
  { id: 'incheon', name: '인천', full: '인천경찰청', stations: 10 },
  { id: 'gwangju', name: '광주', full: '광주경찰청', stations: 5 },
  { id: 'daejeon', name: '대전', full: '대전경찰청', stations: 6 },
  { id: 'ulsan', name: '울산', full: '울산경찰청', stations: 5 },
  { id: 'sejong', name: '세종', full: '세종경찰청', stations: 1 },
  { id: 'ggs', name: '경기남부', full: '경기남부경찰청', stations: 31 },
  { id: 'ggn', name: '경기북부', full: '경기북부경찰청', stations: 13 },
  { id: 'gangwon', name: '강원', full: '강원경찰청', stations: 17 },
  { id: 'chungbuk', name: '충북', full: '충북경찰청', stations: 12 },
  { id: 'chungnam', name: '충남', full: '충남경찰청', stations: 15 },
  { id: 'jeonbuk', name: '전북', full: '전북경찰청', stations: 15 },
  { id: 'jeonnam', name: '전남', full: '전남경찰청', stations: 22 },
  { id: 'gyeongbuk', name: '경북', full: '경북경찰청', stations: 23 },
  { id: 'gyeongnam', name: '경남', full: '경남경찰청', stations: 23 },
  { id: 'jeju', name: '제주', full: '제주경찰청', stations: 3 },
];

/** 타일 지도 배치 (5열 그리드, null=빈칸) */
export const TILE: (string | null)[] = [
  null, null, 'ggn', 'gangwon', null,
  null, 'seoul', 'ggs', null, null,
  'incheon', 'sejong', 'chungbuk', 'gyeongbuk', null,
  null, 'chungnam', 'daejeon', 'daegu', 'ulsan',
  'jeonbuk', 'gwangju', 'gyeongnam', 'busan', null,
  'jeonnam', null, null, null, null,
  'jeju', null, null, null, null,
];

export const STATIONS: Station[] = [
  { id: 's1', region: 'seoul', name: '서울강남경찰서(샘플)', depts: ['수사과 경제1팀', '수사과 경제2팀', '형사과 강력팀', '사이버수사팀', '여성청소년과'], rating: 3.4, reviews: 128 },
  { id: 's2', region: 'seoul', name: '서울마포경찰서(샘플)', depts: ['수사과 경제팀', '형사과', '사이버수사팀'], rating: 3.8, reviews: 86 },
  { id: 's3', region: 'seoul', name: '서울서초경찰서(샘플)', depts: ['수사과 경제1팀', '형사과 강력팀', '여성청소년과'], rating: 3.1, reviews: 104 },
  { id: 's4', region: 'ggs', name: '수원남부경찰서(샘플)', depts: ['수사과 경제팀', '형사과', '사이버수사팀'], rating: 3.6, reviews: 71 },
  { id: 's5', region: 'busan', name: '부산해운대경찰서(샘플)', depts: ['수사과', '형사과', '여성청소년과'], rating: 3.9, reviews: 54 },
];

export const OFFICERS: Officer[] = [
  { id: 'o1', station: 's1', name: '김가상', rank: '경위', dept: '수사과 경제1팀', rating: { fair: 3.2, proc: 3.5, att: 2.9, comm: 2.7, speed: 3.1 }, n: 23,
    history: ['2024.02 서울강남경찰서 수사과(샘플)', '2021.07 서울수서경찰서 형사과(샘플)'], src: '이용자 제보(사건서류 검증)' },
  { id: 'o2', station: 's1', name: '이허구', rank: '경사', dept: '사이버수사팀', rating: { fair: 4.1, proc: 4.3, att: 4.4, comm: 3.9, speed: 3.6 }, n: 17,
    history: ['2023.08 서울강남경찰서 사이버수사팀(샘플)'], src: '관서 홈페이지 공개정보' },
  { id: 'o3', station: 's2', name: '박모형', rank: '경감', dept: '수사과 경제팀', rating: { fair: 3.7, proc: 3.9, att: 3.8, comm: 3.5, speed: 3.2 }, n: 31,
    history: ['2022.01 서울마포경찰서 수사과(샘플)', '2019.02 서울서부경찰서 수사과(샘플)'], src: '인사발령 공고' },
  { id: 'o4', station: 's3', name: '최예시', rank: '경위', dept: '형사과 강력팀', rating: { fair: 2.8, proc: 3.0, att: 2.5, comm: 2.4, speed: 3.3 }, n: 19,
    history: ['2023.07 서울서초경찰서 형사과(샘플)'], src: '이용자 제보(사건서류 검증)' },
  { id: 'o5', station: 's4', name: '정샘플', rank: '경사', dept: '사이버수사팀', rating: { fair: 4.4, proc: 4.5, att: 4.6, comm: 4.2, speed: 4.0 }, n: 12,
    history: ['2024.01 수원남부경찰서 사이버수사팀(샘플)'], src: '관서 홈페이지 공개정보' },
];

export const REVIEWS: Review[] = [
  { officer: 'o1', role: '고소인', type: '사기(경제)', date: '2026.07', stars: 3,
    text: '보완수사 요청 후 3개월간 진행 상황 연락이 없어 직접 여러 차례 문의해야 했습니다. 조사 자체는 절차에 따라 진행되었고 진술 기회는 충분히 부여되었습니다.' },
  { officer: 'o1', role: '피의자 변호인', type: '사기(경제)', date: '2026.05', stars: 4,
    text: '조사 전 진술거부권 등 권리 고지가 정확했고, 변호인 참여에 협조적이었습니다. 조서 열람 시간도 충분히 보장했습니다.' },
  { officer: 'o2', role: '피해자', type: '사이버 명예훼손', date: '2026.06', stars: 5,
    text: '접수 단계부터 절차를 상세히 설명해 주었고, 처리 경과를 문자로 먼저 안내해 주었습니다. 압수물 환부 절차도 신속했습니다.' },
  { officer: 'o4', role: '고소인', type: '폭행', date: '2026.04', stars: 2,
    text: '조사 중 고소인 진술을 자주 끊었고, 제출한 증거자료 일부가 기록에 반영되지 않아 이의를 제기해야 했습니다. 불송치 이유 설명이 부족했습니다.' },
  { officer: 'o5', role: '고소인', type: '전자상거래 사기', date: '2026.08', stars: 5,
    text: '계좌 추적 진행 상황을 단계별로 안내받았습니다. 출석 일정 조율에도 유연하게 응해 주었습니다.' },
];

/** 게시 불가 표현 (프로토타입 기준 단순 포함 검사) */
export const BANNED = ['쓰레기', '무능', '멍청', '개', '새끼', '미친', '병신', '죽어'];

export const REMEDY: Remedy[] = [
  { id: 'attitude', q: '태도가 불친절하거나 진행상황 연락이 없어요',
    ch: '국민신문고 민원', to: 'epeople.go.kr (온라인 통합창구)', base: '민원 처리에 관한 법률',
    how: '국민신문고에 민원을 제출하면 소관기관(경찰청·해당 관서)으로 자동 이송되어 통상 7~14일 내 처리되고 결과를 서면(온라인)으로 회신받습니다.',
    tip: '일시·경위를 구체적으로 기재할수록 실효성이 높습니다. 같은 사안의 반복 제출은 종결 처리될 수 있습니다.' },
  { id: 'unfair', q: '수사가 불공정하다는 구체적 의심이 있어요',
    ch: '수사관 기피신청', to: '해당 경찰서 청문감사(인권)담당관실', base: '범죄수사규칙 제9조',
    how: '불공정 수사의 객관적·구체적 사정을 기재한 기피신청서를 청문감사(인권)담당관실에 제출합니다. 수용되면 담당 수사관이 교체됩니다(공개통계 기준 수용률 약 60~70%).',
    tip: '막연한 불만이 아니라 날짜가 있는 구체적 사실(연락 두절 기간, 편파 발언, 절차 위반 정황)을 적으세요.' },
  { id: 'proc', q: '수사 절차·결과가 부당하다고 판단돼요',
    ch: '수사심의신청', to: '시·도경찰청 수사심의계', base: '경찰수사 심의 관련 규칙',
    how: '수사 과정·결과의 적법성·적정성이 현저히 침해된 경우 시·도경찰청에 심의를 신청할 수 있으며, 심의 결과에 따라 시정 조치됩니다.',
    tip: '기피신청과 달리 절차·결과 자체의 적정성을 다투는 제도입니다.' },
  { id: 'busongchi', q: '불송치 결정에 불복하고 싶어요',
    ch: '불송치 이의신청', to: '불송치 결정을 한 경찰서', base: '형사소송법 제245조의7',
    how: '고소인 등은 불송치 결정에 이의신청할 수 있고, 신청 시 사건은 검찰로 송치됩니다. 기간 제한이 없는 강력한 불복 수단입니다.',
    tip: '불송치 이유서를 먼저 열람·분석한 후 이유를 반박하는 형태로 작성하는 것이 효과적입니다. 변호사 조력의 실익이 가장 큰 단계입니다.' },
  { id: 'rights', q: '조사 중 폭언·강압 등 인권침해를 당했어요',
    ch: '국가인권위원회 진정', to: '국가인권위원회 (1331)', base: '국가인권위원회법',
    how: '조사 과정의 폭언·강압·장시간 조사 등 인권침해에 대해 진정하면 인권위가 조사 후 시정 권고합니다. 경찰서 청문감사인권관 상담과 병행할 수 있습니다.',
    tip: '일시·장소·발언 내용을 최대한 구체적으로 기록해 두세요. 동석자(변호인) 확인이 있으면 유리합니다.' },
  { id: 'corrupt', q: '금품 요구·직권남용 등 중대 비위를 목격했어요',
    ch: '감찰 제보 · 부패신고', to: '경찰청/시·도청 감찰부서, 국민권익위원회', base: '부패방지권익위법 등',
    how: '중대 비위는 경찰 감찰 제보 또는 권익위 부패·공익신고로 접수할 수 있습니다. 신고자 보호(비밀보장·불이익 금지) 제도가 적용됩니다.',
    tip: '증거자료 확보가 핵심입니다. 신원 노출이 우려되면 변호사를 통한 비실명 대리신고 제도를 활용할 수 있습니다.' },
];

/* 조회 헬퍼 */
export const findRegion = (id?: string) => REGIONS.find((r) => r.id === id);
export const findStation = (id?: string) => STATIONS.find((s) => s.id === id);
export const findOfficer = (id?: string) => OFFICERS.find((o) => o.id === id);

export const avgRating = (r: Officer['rating']) =>
  (r.fair + r.proc + r.att + r.comm + r.speed) / 5;
