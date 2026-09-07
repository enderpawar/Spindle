import { bearingDeg, haversineMeters } from '../engine/geo'
import { directionFromHeading, type Departure, type Poi } from '../mock/pois'
import { OLD_TOWN_REGIONS } from './regionCodes'
import { fetchAllOldTownPois, toEnginePoi, type AreaPoi } from './tourapi'

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  '12': '관광지',
  '14': '문화시설',
  '39': '음식점',
}

const DISTRICT_BY_CODE = new Map(OLD_TOWN_REGIONS.map((region) => [region.code, region.name]))
const WALK_SPEED_METERS_PER_MINUTE = 67
const CAFE_CAT3 = 'A05020900'

// 음식점은 구마다 수백 건일 수 있어 지도의 핀 밀도를 제한한다. 30은 업스트림 장애로
// 실건수를 재지 못한 초기값이며, 복구 후 구별 카페·식당 분포를 측정해 조정한다.
export const FOOD_SPOTS_PER_DISTRICT_LIMIT = 30

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

interface FoodSpotCandidate {
  districtCode: string
  category: string
  spot: ExtraSpot
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function compareFoodCandidates(a: FoodSpotCandidate, b: FoodSpotCandidate): number {
  return (
    compareText(a.districtCode, b.districtCode) ||
    Number(a.category !== '카페') - Number(b.category !== '카페') ||
    compareText(a.spot.name, b.spot.name) ||
    compareText(a.spot.contentId, b.spot.contentId)
  )
}

/** areaBasedList2 목록을 명소 지도용 점 데이터로 정리한다. */
export function transformExtraSpots(
  pois: readonly AreaPoi[],
  excludeContentIds: ReadonlySet<string>,
  foodLimitPerDistrict = FOOD_SPOTS_PER_DISTRICT_LIMIT,
): ExtraSpot[] {
  const seenContentIds = new Set<string>()
  const spots: ExtraSpot[] = []
  const foodCandidates: FoodSpotCandidate[] = []

  for (const poi of pois) {
    const contentId = poi.contentid.trim()
    const name = poi.title.trim()
    const contentTypeId = poi.contenttypeid.trim()
    const districtCode = poi.sigungucode.trim()
    const category =
      contentTypeId === '39' && poi.cat3?.trim() === CAFE_CAT3
        ? '카페'
        : CATEGORY_LABELS[contentTypeId]
    const district = DISTRICT_BY_CODE.get(districtCode)

    if (!contentId || !name || !category || !district) continue
    if (excludeContentIds.has(contentId)) continue

    const enginePoi = toEnginePoi(poi)
    if (!enginePoi) continue

    const spot: ExtraSpot = {
      id: `tour-${contentId}`,
      contentId,
      name,
      category,
      district,
      lat: enginePoi.point.lat,
      lon: enginePoi.point.lng,
      address: poi.addr1.trim() || undefined,
    }

    if (contentTypeId === '39') {
      foodCandidates.push({ districtCode, category, spot })
      continue
    }

    if (seenContentIds.has(contentId)) continue
    seenContentIds.add(contentId)
    spots.push(spot)
  }

  const foodCountByDistrict = new Map<string, number>()
  for (const candidate of foodCandidates.sort(compareFoodCandidates)) {
    const { districtCode, spot } = candidate
    if (seenContentIds.has(spot.contentId)) continue
    const count = foodCountByDistrict.get(districtCode) ?? 0
    if (count >= foodLimitPerDistrict) continue

    seenContentIds.add(spot.contentId)
    foodCountByDistrict.set(districtCode, count + 1)
    spots.push(spot)
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
