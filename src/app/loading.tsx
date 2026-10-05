import { Card } from '@/components/ui';

/** 전역 로딩 상태(페이지 전환 시 데이터가 아직 안 왔을 때). 실제 레이아웃과 비슷한 모양의
 * 스켈레톤을 보여줘서 "멈춘 건지 로딩 중인지" 헷갈리지 않게 한다. */
export default function Loading() {
  return (
    <>
      <div className="skeleton sk-crumb" />
      <div className="skeleton sk-title" />
      <Card>
        <div className="skeleton sk-line" style={{ width: '45%' }} />
        <div className="skeleton sk-line" style={{ width: '92%' }} />
        <div className="skeleton sk-line" style={{ width: '78%' }} />
        <div className="skeleton sk-line" style={{ width: '85%', marginBottom: 0 }} />
      </Card>
      <Card>
        <div className="skeleton sk-line" style={{ width: '35%' }} />
        <div className="skeleton sk-block" />
      </Card>
    </>
  );
}
