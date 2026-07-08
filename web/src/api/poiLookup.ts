/**
 * 루트 앱의 기존 mock POI 화면을 TourAPI 상세와 느슨하게 연결한다.
 * 조회는 허용된 areaBasedList2 목록 + contentId 상세만 사용하며, 사용자 좌표·방위각은 보내지 않는다.
 */
import { fetchAllOldTownPois } from "./tourapi";
import { fetchPoiDetailCached, type PoiDetail } from "./details";

type FetchLike = typeof fetch;

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, "").trim();
}

const titleDetailCache = new Map<string, Promise<PoiDetail | null>>();

export function fetchPoiDetailByTitleCached(
  title: string,
  fetchImpl: FetchLike = fetch,
): Promise<PoiDetail | null> {
  const key = normalizeTitle(title);
  const cached = titleDetailCache.get(key);
  if (cached) return cached;

  const pending = fetchAllOldTownPois(fetchImpl)
    .then((regions) => {
      const pois = regions.flatMap(({ pois: regionPois }) => regionPois);
      const exact = pois.find((poi) => normalizeTitle(poi.title) === key);
      if (!exact) return null;
      return fetchPoiDetailCached(exact.contentid, fetchImpl);
    })
    .catch(() => null);

  titleDetailCache.set(key, pending);
  return pending;
}

/** 테스트용 */
export function clearPoiLookupCache(): void {
  titleDetailCache.clear();
}
