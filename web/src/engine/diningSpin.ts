import { toDisplayPoi, type ExtraSpot } from '../api/extraSpots'
import { directionOf, type Recommendation } from '../mock/pois'
import { recommend } from './recommend'
import { dispersionWeightOf, operationScoreOf, toGeo, type SpinRecommendInput } from './spinRecommend'

export type SpinCategory = '전체' | '음식점' | '카페'
export type DiningCategory = Exclude<SpinCategory, '전체'>

/** 종류와 이동시간 한도를 보존한다. 빈 결과를 다른 종류/무제한 후보로 대체하지 않는다. */
export function recommendDiningSpin(input: Omit<SpinRecommendInput, 'themeJourney'> & {
  category: DiningCategory
  spots: readonly ExtraSpot[]
}): Recommendation {
  const pool = input.spots.filter(spot => spot.category === input.category)
  const byId = new Map(pool.map(spot => [spot.contentId, spot]))
  const result = recommend({
    origin: toGeo(input.departure), heading: input.heading, budgetMinutes: input.budgetMinutes,
    prevContentId: input.prevContentId, rng: input.rng ?? Math.random,
    operationScoreOf, dispersionWeightOf,
    pois: pool.map(spot => ({ contentId: spot.contentId, title: spot.name, point: { lat: spot.lat, lng: spot.lon } })),
  })
  return {
    direction: directionOf(result.sector),
    diningCategory: input.category,
    candidates: (result.picked ? [result.picked, ...result.alternates] : []).map(candidate => ({
      ...toDisplayPoi(byId.get(candidate.poi.contentId)!, input.departure),
      tier: 2,
      walkMinutes: Math.max(1, Math.round(candidate.travel.minutes)),
    })),
    expandReason: result.picked && result.expansion !== 'none'
      ? `이 방향에는 조건에 맞는 ${input.category === '카페' ? '카페가' : '음식점이'} 없어 가까운 방향까지 찾아봤어요`
      : undefined,
  }
}
