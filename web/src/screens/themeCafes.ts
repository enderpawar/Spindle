import { fetchExtraSpots, type ExtraSpot } from '../api/extraSpots'
import { CURATED_CONTENT_IDS } from '../engine/spinRecommend'

const CURATED_CONTENT_ID_SET = new Set(CURATED_CONTENT_IDS)

/** 명소 화면과 같은 fetchAllOldTownPois 세션 캐시에서 카페만 고른다. */
export async function fetchThemeCafes(
  loadExtraSpots: (exclude: ReadonlySet<string>) => Promise<ExtraSpot[]> = fetchExtraSpots,
): Promise<ExtraSpot[]> {
  try {
    const spots = await loadExtraSpots(CURATED_CONTENT_ID_SET)
    return spots.filter((spot) => spot.category === '카페')
  } catch {
    // 보조 섹션의 조회 실패는 빈 목록과 동일하게 처리해 큐레이션 덱을 지킨다.
    return []
  }
}
