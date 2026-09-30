/* 언론·감독기관 제보 안내 페이지의 정적 콘텐츠. 전부 공개된 접수 채널 정보이며 백엔드로 전송하지 않는다. */

export interface PressChannel {
  name: string;
  desc: string;
  url: string;
  email?: string;
}

export interface OversightOrg {
  name: string;
  desc: string;
  url?: string;
  tel?: string;
}

export const PRESS_CHANNELS: PressChannel[] = [
  { name: 'TV조선 뉴스 제보', desc: '카카오톡 채널 "TV조선제보" 운영 · 영상·사진 제보', url: 'https://news.tvchosun.com/' },
  { name: '조선일보 제보', desc: '', url: 'https://www.chosun.com/' },
  { name: '채널A 뉴스 제보', desc: '홈페이지·앱 내 제보 메뉴', url: 'https://www.ichannela.com/' },
  { name: '동아일보 제보', desc: '', url: 'https://www.donga.com/' },
  { name: '문화일보 제보', desc: '', url: 'https://www.munhwa.com/' },
  { name: '연합뉴스 제보', desc: '국가기간 통신사 — 카카오톡·라인 "okjebo"', url: 'https://www.yna.co.kr/', email: 'okjebo@yna.co.kr' },
  { name: 'YTN 제보', desc: '보도전문채널 제보 페이지', url: 'https://mj.ytn.co.kr/' },
  { name: 'SBS 뉴스 제보', desc: '홈페이지·앱 내 제보 메뉴', url: 'https://news.sbs.co.kr/' },
];

export const OVERSIGHT_ORGS: OversightOrg[] = [
  { name: '국민권익위원회 청렴포털', desc: '부패·공익신고 — 공익신고자 보호법상 신분보장·불이익 금지·구조금의 대상이 되는 법정 신고처', url: 'https://www.clean.go.kr/', tel: '국번없이 1398' },
  { name: '국가인권위원회', desc: '조사 과정의 폭언·강압·장시간 조사 등 인권침해 진정', url: 'https://www.humanrights.go.kr/', tel: '국번없이 1331' },
  { name: '경찰청 감찰(국민신문고)', desc: '경찰관 비위 신고 — 국민신문고를 통해 감찰부서로 이송', url: 'https://www.epeople.go.kr/' },
  { name: '해당 경찰서 청문감사인권관실', desc: '소속 경찰관 비위 상담·신고, 수사관 기피신청 접수', tel: '각 서 대표번호' },
];

export const REPORT_CATEGORIES = [
  '부실수사·직무유기', '불공정·편파 수사', '금품·향응 등 중대 비위', '조사 중 인권침해', '사건 은폐·조작', '기타',
];
