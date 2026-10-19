/** 이용약관·개인정보처리방침에 공통으로 들어가는 운영 정보. 운영 주체나 연락처가 바뀌면 여기만 고친다.
 * TERMS_VERSION 은 회원가입 동의 기록(users.terms_version)에 함께 저장되므로, 문서 내용을 바꾸면
 * 시행일과 함께 올린다. */
export const LEGAL = {
  serviceName: '폴리스맵',
  operator: '폴리스맵 운영팀',
  privacyOfficer: '폴리스맵 운영팀',
  contactEmail: 'admin@policemap.kr',
  effectiveDate: '2026년 10월 20일',
} as const;

export const TERMS_VERSION = '2026-10-20';
