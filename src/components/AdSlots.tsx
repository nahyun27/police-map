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
  // null = 아직 불러오는 중. 이때 "이 자리에 광고하세요" 안내를 먼저 그리면 광고가 있어도 안내가 잠깐
  // 보였다가 광고로 바뀌어 깜빡이므로, 응답이 올 때까지는 그 자리를 비워 둔다.
  const [ads, setAds] = useState<AdOut[] | null>(null);

  useEffect(() => {
    const m = window.matchMedia(WIDE_QUERY);
    const apply = () => setMode(m.matches ? 'side' : 'wide');
    apply();
    m.addEventListener('change', apply);
    return () => m.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!mode) return;
    setAds(null); // 슬롯 종류가 바뀌면 이전 슬롯 광고(세로 이미지 없을 수 있음)를 먼저 비운다
    let cancelled = false;
    listAds({ regionId, stationId, slot: mode, limit: mode === 'side' ? 2 : 1 })
      .then((r) => { if (!cancelled) setAds(r); })
      .catch(() => { if (!cancelled) setAds([]); });
    return () => { cancelled = true; };
  }, [mode, regionId, stationId]);

  if (mode === 'side') {
    if (ads === null) return null;
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
        {/* 집행 중인 광고가 없으면 자리 자체를 비워 둔다("광고하세요" 안내는 어색하다는 의견으로 뺐다). */}
        {right && (
          <aside className="ad-rail right" aria-label="광고">
            <a href={apiAsset(right.click_url)} target="_blank" rel="noopener sponsored">
              {/* eslint-disable-next-line @next/next/no-img-element -- 외부 업로드 배너, 크기 고정 */}
              <img src={apiAsset(right.image_side_url!)} alt={right.title} width={160} />
            </a>
            <AdLabel ad={right} />
          </aside>
        )}
      </>
    );
  }

  if (mode === 'wide' && ads?.[0]) {
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
