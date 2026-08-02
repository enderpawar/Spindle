/** 활성 코스의 탐험형 방향·도착 판정. 모든 입력은 단말 메모리에서만 소비한다. */
import { bearingDeg, haversineMeters, type GeoPoint } from './geo'

export type GuidanceTurn = 'forward' | 'right' | 'left' | 'behind'

export interface GuidanceSnapshot {
  distanceM: number
  targetBearingDeg: number
  relativeDeg: number
  turn: GuidanceTurn
}

export const ARRIVAL_DISTANCE_M = 50
export const ARRIVAL_MAX_ACCURACY_M = 80
export const ARRIVAL_REQUIRED_SAMPLES = 2
const TURN_HYSTERESIS_DEG = 8

/** 각도 차이를 [-180, 180)로 정규화한다. 양수는 오른쪽, 음수는 왼쪽이다. */
export function relativeHeadingDeg(targetBearing: number, deviceHeading: number): number {
  return ((targetBearing - deviceHeading + 540) % 360) - 180
}

function baseTurn(relativeDeg: number): GuidanceTurn {
  const abs = Math.abs(relativeDeg)
  if (abs <= 30) return 'forward'
  if (relativeDeg > 30 && relativeDeg < 150) return 'right'
  if (relativeDeg < -30 && relativeDeg > -150) return 'left'
  return 'behind'
}

function remainsInExpandedTurn(relativeDeg: number, previous: GuidanceTurn): boolean {
  const abs = Math.abs(relativeDeg)
  switch (previous) {
    case 'forward':
      return abs <= 30 + TURN_HYSTERESIS_DEG
    case 'right':
      return relativeDeg > 30 - TURN_HYSTERESIS_DEG && relativeDeg < 150 + TURN_HYSTERESIS_DEG
    case 'left':
      return relativeDeg < -30 + TURN_HYSTERESIS_DEG && relativeDeg > -150 - TURN_HYSTERESIS_DEG
    case 'behind':
      return abs >= 150 - TURN_HYSTERESIS_DEG
  }
}

/** 경계에서 화살표가 튀지 않도록 직전 분류를 8° 더 유지한다. */
export function guidanceTurn(relativeDeg: number, previous?: GuidanceTurn): GuidanceTurn {
  if (previous && remainsInExpandedTurn(relativeDeg, previous)) return previous
  return baseTurn(relativeDeg)
}

export function guidanceSnapshot(
  current: GeoPoint,
  target: GeoPoint,
  deviceHeading: number,
  previousTurn?: GuidanceTurn,
): GuidanceSnapshot {
  const targetBearingDeg = bearingDeg(current, target)
  const relativeDeg = relativeHeadingDeg(targetBearingDeg, deviceHeading)
  return {
    distanceM: haversineMeters(current, target),
    targetBearingDeg,
    relativeDeg,
    turn: guidanceTurn(relativeDeg, previousTurn),
  }
}

export interface ArrivalProgress {
  consecutive: number
  arrived: boolean
}

/** 정확한 표본만 사용하고, 50m 밖으로 나가면 연속 횟수를 초기화한다. */
export function advanceArrival(
  previousConsecutive: number,
  distanceM: number,
  accuracyM: number,
): ArrivalProgress {
  if (!Number.isFinite(accuracyM) || accuracyM > ARRIVAL_MAX_ACCURACY_M) {
    return { consecutive: previousConsecutive, arrived: false }
  }
  const consecutive = distanceM <= ARRIVAL_DISTANCE_M ? previousConsecutive + 1 : 0
  return { consecutive, arrived: consecutive >= ARRIVAL_REQUIRED_SAMPLES }
}
