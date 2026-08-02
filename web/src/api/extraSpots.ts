import { bearingDeg, haversineMeters } from '../engine/geo'
import { directionFromHeading, type Departure, type Poi } from '../mock/pois'
import { OLD_TOWN_REGIONS } from './regionCodes'
import { fetchAllOldTownPois, toEnginePoi, type AreaPoi } from './tourapi'

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  '12': '관광지',
  '14': '문화시설',
}

const DISTRICT_BY_CODE = new Map(OLD_TOWN_REGIONS.map((region) => [region.code, region.name]))
const WALK_SPEED_METERS_PER_MINUTE = 67

export interface ExtraSpot {
  id: string
  contentId: string
  name: string
  category: string
  district: string
  lat: number
  lon: number
  /** 상세 카드의 소개 폴백에 쓰는 TourAPI 주소. */
  address?: string
}

/** areaBasedList2 목록을 명소 지도용 점 데이터로 정리한다. */
export function transformExtraSpots(
  pois: readonly AreaPoi[],
  excludeContentIds: ReadonlySet<string>,
): ExtraSpot[] {
  const seenContentIds = new Set<string>()
  const spots: ExtraSpot[] = []

  for (const poi of pois) {
    const contentId = poi.contentid.trim()
    const name = poi.title.trim()
    const category = CATEGORY_LABELS[poi.contenttypeid.trim()]
    const district = DISTRICT_BY_CODE.get(poi.sigungucode.trim())

    if (!contentId || !name || !category || !district) continue
    if (excludeContentIds.has(contentId) || seenContentIds.has(contentId)) continue

    const enginePoi = toEnginePoi(poi)
    if (!enginePoi) continue

    seenContentIds.add(contentId)
    spots.push({
      id: `tour-${contentId}`,
      contentId,
      name,
      category,
      district,
      lat: enginePoi.point.lat,
      lon: enginePoi.point.lng,
      address: poi.addr1.trim() || undefined,
    })
  }

  return spots
}

/** 세션 시작 때 받은 4개 구 목록 캐시를 재사용한다. */
export async function fetchExtraSpots(
  excludeContentIds: ReadonlySet<string>,
): Promise<ExtraSpot[]> {
  const regions = await fetchAllOldTownPois()
  return transformExtraSpots(regions.flatMap(({ pois }) => pois), excludeContentIds)
}

/** 전체 명소 점을 기존 상세 화면이 받는 Poi 형태로 단말 안에서 변환한다. */
export function toDisplayPoi(spot: ExtraSpot, departure: Departure): Poi {
  const origin = { lat: departure.lat, lng: departure.lon }
  const destination = { lat: spot.lat, lng: spot.lon }
  const direction = directionFromHeading(bearingDeg(origin, destination)).id
  const walkMinutes = Math.ceil(
    haversineMeters(origin, destination) / WALK_SPEED_METERS_PER_MINUTE,
  )

  return {
    id: spot.id,
    contentId: spot.contentId,
    name: spot.name,
    category: spot.category,
    district: spot.district,
    direction,
    tier: 3,
    walkMinutes,
    open: { known: false, text: '운영시간은 상세에서 확인' },
    story: spot.address?.trim() || '한국관광공사 등록 관광지',
    lat: spot.lat,
    lon: spot.lon,
  }
}
