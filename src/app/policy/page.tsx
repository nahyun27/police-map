import type { Metadata } from 'next';
import { Check, FileCheck2, Scale, ShieldCheck, UserRoundCheck, type LucideIcon } from 'lucide-react';
import { Card, PageHead } from '@/components/ui';

export const metadata: Metadata = {
  title: '운영원칙',
  description: '폴리스맵의 게시물·개인정보·당사자 보호·중립성 운영원칙.',
};

const SECTIONS: { title: string; icon: LucideIcon; items: string[] }[] = [
  { title: '게시물 원칙', icon: FileCheck2, items: [
    '전량 선검수 후게시(24~48시간)',
    '직무수행 관련 사실 중심 서술만 게시',
    '인신공격·사생활·허위사실 게시 거부',
    '사건관계인·변호인만 작성 가능(경험 검증)',
    '휴대폰 본인인증 기반 작성(작성자 책임)',
  ] },
  { title: '개인정보 원칙', icon: ShieldCheck, items: [
    '게재 정보는 성명·계급·소속 등 직무 관련 정보로 한정',
    '사진·연락처·나이·가족·SNS 등 사생활 정보 게재 금지',
    '모든 정보에 출처(공고·홈페이지·언론·검증 제보) 관리',
    '정보주체의 열람·정정·삭제 요구권 보장',
  ] },
  { title: '당사자 보호 절차', icon: UserRoundCheck, items: [
    '삭제·정정 요청 전용 창구 운영',
    '접수 즉시 임시조치(블라인드) 후 10일 내 재검토',
    '처리 결과 양측 통지, 전 과정 기록 보존',
    '분기별 투명성 보고서(게시·반려·삭제 건수) 공개',
  ] },
  { title: '중립성', icon: Scale, items: [
    '긍정·부정 평가의 동등한 노출',
    '광고와 콘텐츠의 명확한 구분 표시',
    '특정 사건·변호사 알선 금지(정액 광고만 운영)',
    '운영진의 개별 게시물 개입 기록화',
  ] },
];

export default function PolicyPage() {
  return (
    <>
      <PageHead
        eyebrow="운영원칙"
        title="공익을 위한 네 가지 원칙"
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
