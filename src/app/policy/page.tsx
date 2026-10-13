import type { Metadata } from 'next';
import { Check, FileCheck2, Flag, Megaphone, Scale, ShieldCheck, UserRoundCheck, type LucideIcon } from 'lucide-react';
import { Card, PageHead } from '@/components/ui';

export const metadata: Metadata = {
  title: '운영원칙',
  description: '폴리스맵의 게시물·개인정보·당사자 보호·중립성 운영원칙.',
};

const SECTIONS: { title: string; icon: LucideIcon; items: string[] }[] = [
  { title: '평가·게시판 원칙', icon: FileCheck2, items: [
    '작성 즉시 게시(사전 검수 없음), 금칙어는 자동 필터링',
    '직무수행 관련 사실 중심 서술만 게시',
    '인신공격·사생활·허위사실 게시 거부, 적발 시 사후 삭제',
    '경찰서 평가는 사건관계인·변호인만 작성 가능(자가 신고 기준)',
    '게시물에 대한 법적 책임은 작성자 본인이 부담',
    '증빙자료를 남기면 운영진 확인 후 "증빙확인" 배지 부여 — 자료 제출 사실만 확인한 것으로, 서술 내용 전체의 사실 여부를 보증하지는 않음',
  ] },
  { title: '사건 공론화 원칙', icon: Megaphone, items: [
    '본인이 직접 겪은 수사 경험(또는 정당한 대리인)만 기록',
    '로그인 회원만 작성·공감·신고, 비회원은 열람·공유만 가능',
    '실명·연락처·사건번호 등 개인정보로 보이는 글은 운영진 확인 후 공개',
    '공개는 게시 기준 충족일 뿐 사실 확인이 아니며, 공감은 사실 인정이나 법적 동의가 아님',
    '폴리스맵은 언론·기관에 사건을 전달하지 않음 — 공식 민원·신고는 이용자가 직접(권리구제·제보 안내 제공)',
    '진행 기록은 모두 작성자 진술로 표시',
  ] },
  { title: '개인정보 원칙', icon: ShieldCheck, items: [
    '게재 정보는 성명·계급·소속 등 직무 관련 정보로 한정',
    '사진·연락처·나이·가족·SNS 등 사생활 정보 게재 금지',
    '모든 정보에 출처(공고·홈페이지·언론·검증 제보) 관리',
    '정보주체의 열람·정정·삭제 요구권 보장',
  ] },
  { title: '신고·블라인드', icon: Flag, items: [
    '평가·게시글·사건 모두 신고 가능(로그인 회원)',
    '서로 다른 회원 5명 이상 신고 시 자동 블라인드',
    '심각한 경우 운영진이 신고 수와 관계없이 즉시 블라인드',
    '블라인드는 삭제가 아닌 비공개 조치이며, 작성자는 마이페이지에서 상태와 사유를 확인 가능',
    '자동 블라인드는 운영진이 신고 내용을 검토한 뒤에만 해제(신고 수가 줄어든다고 저절로 풀리지 않음)',
  ] },
  { title: '당사자 보호 절차', icon: UserRoundCheck, items: [
    '삭제·정정 요청 전용 창구 운영(평가·사건 공론화)',
    '접수 즉시 임시조치(블라인드) 후 10일 내 재검토',
    '처리 결과 양측 통지, 전 과정 기록 보존',
    '분기별 투명성 보고서(게시·반려·삭제 건수) 공개',
  ] },
  { title: '중립성', icon: Scale, items: [
    '긍정·부정 평가의 동등한 노출',
    '광고와 콘텐츠의 명확한 구분 표시 — 모든 광고에 "광고" 표기, 지역 단위로만 노출하며 평가·순위에 영향 없음',
    '특정 사건·변호사 알선 금지(정액 광고만 운영)',
    '운영진의 개별 게시물 개입 기록화',
  ] },
];

export default function PolicyPage() {
  return (
    <>
      <PageHead
        eyebrow="운영원칙"
        title="공익을 위한 운영원칙"
        sub="폴리스맵은 공무집행의 투명성 제고라는 공익 목적을 위해 다음 원칙에 따라 운영됩니다."
      />
      <div className="grid2">
        {SECTIONS.map(({ title, icon: Icon, items }) => (
          <Card key={title}>
            <div className="policy-ico"><Icon size={20} /></div>
            <h2>{title}</h2>
            <ul className="checks">
              {items.map((t) => (
                <li key={t}><Check size={16} /><span>{t}</span></li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
