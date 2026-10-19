'use server';

import { updateTag } from 'next/cache';
import { stationCacheTag } from '@/lib/api';

/** 평가를 올린 직후 "게시된 평가 보기"로 가면 경찰서 상세가 최대 30초 묵은 Data Cache
 * (getStation 의 revalidateSeconds)로 떠서 방금 쓴 평가가 안 보였다. 평가 제출 자체는 브라우저가
 * 백엔드로 직접 보내므로(쿠키·IP 기준 처리) 그대로 두고, 성공한 뒤에 이 액션으로 그 관서의 캐시만
 * 비운다. getStation 을 아예 no-store 로 바꾸면 공개 페이지마다 매번 백엔드를 치게 돼서 이쪽을 골랐다.
 * 누구나 부를 수 있는 액션이지만 하는 일은 공개 캐시 한 항목을 비우는 것뿐이라 숫자 id 만 받는다. */
export async function refreshStationCache(stationId: number): Promise<void> {
  if (!Number.isInteger(stationId) || stationId <= 0) return;
  updateTag(stationCacheTag(stationId));
}
