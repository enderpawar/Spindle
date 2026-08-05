import {
  matchBusyPois,
  matchComfortablePois,
  type CongestionForecast,
  type NamedPoi,
} from '../api/congestion'

export type CongestionVisualStatus = 'busy' | 'good'

export const CONGESTION_STATUS_LABELS: Readonly<Record<CongestionVisualStatus, string>> = {
  busy: '오늘 혼잡 예상',
  good: '오늘 가기 좋아요',
}

/** 예측값을 화면 전용 상태로 바꾼다. 추천 엔진에는 이 값을 전달하지 않는다. */
export function buildCongestionStatusMap(
  pois: readonly NamedPoi[],
  forecasts: readonly CongestionForecast[],
  targetDate: string,
): ReadonlyMap<string, CongestionVisualStatus> {
  const statuses = new Map<string, CongestionVisualStatus>()
  for (const poiId of matchComfortablePois(pois, forecasts, targetDate).keys()) {
    statuses.set(poiId, 'good')
  }
  for (const poiId of matchBusyPois(pois, forecasts, targetDate).keys()) {
    statuses.set(poiId, 'busy')
  }
  return statuses
}

/** 운영 중단 안내가 혼잡 예측보다 우선한다. */
export function mapPinLabel(
  name: string,
  closed: boolean,
  status?: CongestionVisualStatus,
): string {
  if (closed) return `${name}, 지금 갈 수 없어요`
  return status ? `${name}, ${CONGESTION_STATUS_LABELS[status]}` : name
}
