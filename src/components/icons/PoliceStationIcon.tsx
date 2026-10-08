import type { SVGProps } from 'react';

/**
 * 경찰서 위치를 나타내는 전용 아이콘. 방패(경찰 배지) 모양에 별을 넣어 "공공 치안기관"임을
 * 바로 알아볼 수 있게 했다. lucide-react 아이콘들과 같은 방식(size prop, 나머지 props 는
 * svg 에 그대로 전달)으로 써서 다른 아이콘과 나란히 둬도 크기·정렬이 자연스럽다.
 *
 * 지도 핀처럼 아주 작게 쓰는 곳(예: RegionMiniMap)은 별 디테일이 그 크기에서 뭉개지므로,
 * 이 컴포넌트를 그대로 쓰지 말고 방패 윤곽만 따로 그린다(해당 파일의 shieldPath 참고).
 */
export function PoliceStationIcon({ size = 20, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      xmlns="http://www.w3.org/2000/svg" {...props}
    >
      <path d="M12 1.6l7.6 2.85v5.9c0 5.2-3.25 9.5-7.6 10.85-4.35-1.35-7.6-5.65-7.6-10.85v-5.9L12 1.6z" />
      <path
        d="M12 6.3l1.06 2.18 2.4.35-1.74 1.7.41 2.4L12 11.85l-2.13 1.08.41-2.4-1.74-1.7 2.4-.35z"
        fill="#fff"
      />
    </svg>
  );
}
