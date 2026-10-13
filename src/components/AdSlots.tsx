'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiAsset, listAds, type AdOut } from '@/lib/api';

// 넓은 PC 화면(본문 1120px + 양옆 배너 160px 두 개가 들어가는 폭)에서만 양옆 고정 배너를 쓰고,
// 그보다 좁으면 본문 맨 아래 가로 배너 한 장으로 바꾼다. globals.css 의 .ad-rail 미디어쿼리와 같은 값.
const WIDE_QUERY = '(min-width: 1500px)';

function AdLabel({ ad }: { ad: AdOut }) {
  return <span className="ad-label">광고 · {ad.advertiser}</span>;
}

/** 지역 타겟 광고. regionId(지역 페이지) 또는 stationId(경찰서 → 그 지역)를 주면 그 지역 광고를 먼저,
 * 없으면 전국 광고를 보여준다. 화면 폭에 맞는 슬롯 한 종류만 불러와서 실제로 보이는 광고만 노출로 센다. */
export function AdSlots({ regionId, stationId }: { regionId?: string; stationId?: number }) {
  const [mode, setMode] = useState<'side' | 'wide' | null>(null);
  const [ads, setAds] = useState<AdOut[]>([]);

  useEffect(() => {
    const m = window.matchMedia(WIDE_QUERY);
    const apply = () => setMode(m.matches ? 'side' : 'wide');
    apply();
    m.addEventListener('change', apply);
    return () => m.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    listAds({ regionId, stationId, slot: mode, limit: mode === 'side' ? 2 : 1 })
      .then((r) => { if (!cancelled) setAds(r); })
      .catch(() => { if (!cancelled) setAds([]); });
    return () => { cancelled = true; };
  }, [mode, regionId, stationId]);

  if (mode === 'side') {
    const [left, right] = ads.length === 1 ? [undefined, ads[0]] : ads;
    return (
      <>
        {left && (
          <aside className="ad-rail left" aria-label="광고">
            <a href={apiAsset(left.click_url)} target="_blank" rel="noopener sponsored">
              {/* eslint-disable-next-line @next/next/no-img-element -- 외부 업로드 배너, 크기 고정 */}
              <img src={apiAsset(left.image_side_url!)} alt={left.title} width={160} />
            </a>
            <AdLabel ad={left} />
          </aside>
        )}
        <aside className="ad-rail right" aria-label="광고">
          {right ? (
            <>
              <a href={apiAsset(right.click_url)} target="_blank" rel="noopener sponsored">
                {/* eslint-disable-next-line @next/next/no-img-element -- 외부 업로드 배너, 크기 고정 */}
                <img src={apiAsset(right.image_side_url!)} alt={right.title} width={160} />
              </a>
              <AdLabel ad={right} />
            </>
          ) : (
            // 집행 중인 광고가 없으면 빈 자리 대신 "광고 모집" 안내를 둔다(수익화 창구).
            <Link href="/advertise" className="ad-rail-empty">
              <b>이 자리에<br />광고하세요</b>
              <span>지역별 타겟 광고<br />문의 받습니다</span>
            </Link>
          )}
        </aside>
      </>
    );
  }

  if (mode === 'wide' && ads[0]) {
    const ad = ads[0];
    return (
      <div className="ad-bottom" aria-label="광고">
        <a href={apiAsset(ad.click_url)} target="_blank" rel="noopener sponsored">
          {/* eslint-disable-next-line @next/next/no-img-element -- 외부 업로드 배너 */}
          <img src={apiAsset(ad.image_wide_url)} alt={ad.title} />
        </a>
        <AdLabel ad={ad} />
      </div>
    );
  }
  return null;
}

/** 권리구제 페이지 안의 광고란(본문 안 가로 배너). 광고가 없으면 문의 안내를 보여준다. */
export function AdInline({ regionId, stationId }: { regionId?: string; stationId?: number }) {
  const [ads, setAds] = useState<AdOut[] | null>(null);
  useEffect(() => {
    listAds({ regionId, stationId, slot: 'wide', limit: 2 }).then(setAds).catch(() => setAds([]));
  }, [regionId, stationId]);

  if (ads === null) return null;
  if (!ads.length) {
    return (
      <p className="sub">
        현재 집행 중인 광고가 없습니다. <Link href="/advertise">광고·제휴 문의하기</Link>
      </p>
    );
  }
  return (
    <div className="ad-inline">
      {ads.map((ad) => (
        <div key={ad.id}>
          <a href={apiAsset(ad.click_url)} target="_blank" rel="noopener sponsored">
            {/* eslint-disable-next-line @next/next/no-img-element -- 외부 업로드 배너 */}
            <img src={apiAsset(ad.image_wide_url)} alt={ad.title} />
          </a>
          <AdLabel ad={ad} />
        </div>
      ))}
    </div>
  );
}
