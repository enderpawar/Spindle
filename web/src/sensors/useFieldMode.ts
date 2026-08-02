/**
 * 현장 모드 — 실제 기기 방위로 원판을 돌리고 현재 위치를 출발점으로 쓴다 (PLAN Phase 4).
 *
 * 좌표·방위각은 이 훅 안에서만 살아 있고 네트워크·로그·영속 저장소로 나가지 않는다
 * (AGENTS.md 절대 원칙 1). GPS는 `getCurrentFix()` 1회 취득만 사용하며 `watchPosition`은
 * 쓰지 않는다 (sensors 스킬 규약).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { HeadingSmoother } from '../engine/heading'
import type { GeoPoint } from '../engine/geo'
import { zoneOf } from '../engine/zones'
import type { Departure } from '../mock/pois'
import { getCurrentFix, GeoFixError } from './geolocation'
import { requestOrientationPermission, subscribeHeading } from './orientation'

export type FieldStatus = 'off' | 'requesting' | 'on' | 'unavailable'

/** 기기 방위가 이 시간 이상 안정되면 자동 잠금. 켜자마자 잠기지 않도록 조준 유예를 둔다. */
const AIM_GRACE_MS = 2_500

/** 현재 위치를 추천 엔진이 쓰는 출발점 형태로 감싼다 — 단말 내 전용 객체다. */
export function fieldOriginFrom(point: GeoPoint): Departure {
  return {
    id: 'field-current',
    name: '내 위치',
    desc: '현재 위치 기준',
    lat: point.lat,
    lon: point.lng,
  }
}

export interface FieldMode {
  status: FieldStatus
  /** 스무딩된 기기 방위각 (0=북, 시계방향). 현장 모드가 아니면 null */
  heading: number | null
  /** 실패 사유 — 사용자에게 그대로 보여줄 문장 */
  notice: string | null
  /** 현재 위치 출발점. 현장 모드가 아니면 null */
  origin: Departure | null
  /** 방위가 안정돼 자동 잠금해도 되는 상태인가 */
  aimed: boolean
  enable: () => Promise<void>
  disable: () => void
}

export function useFieldMode(): FieldMode {
  const [status, setStatus] = useState<FieldStatus>('off')
  const [heading, setHeading] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [origin, setOrigin] = useState<Departure | null>(null)
  const [aimed, setAimed] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const disable = useCallback(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    setStatus('off')
    setHeading(null)
    setOrigin(null)
    setAimed(false)
    setNotice(null)
  }, [])

  // 언마운트 시 센서 구독 해제 — 화면을 떠나면 방위를 더 읽지 않는다.
  useEffect(() => () => unsubscribeRef.current?.(), [])

  const enable = useCallback(async () => {
    setNotice(null)
    setStatus('requesting')

    // iOS는 사용자 제스처 안에서 권한을 요청해야 한다 — enable()이 onClick에서 바로 호출된다.
    const permission = await requestOrientationPermission()
    if (permission !== 'granted') {
      setStatus('unavailable')
      setNotice(permission === 'denied'
        ? '나침반 권한이 거부돼 현장 모드를 쓸 수 없어요. 여행 모드로 계속할 수 있어요.'
        : '이 기기에서는 나침반을 읽을 수 없어요. 여행 모드로 계속할 수 있어요.')
      return
    }

    let point: GeoPoint
    try {
      point = await getCurrentFix()
    } catch (error) {
      setStatus('unavailable')
      setNotice(error instanceof GeoFixError && error.kind === 'denied'
        ? '위치 권한이 거부돼 현재 위치를 출발점으로 쓸 수 없어요. 여행 모드로 계속할 수 있어요.'
        : '현재 위치를 확인하지 못했어요. 여행 모드로 계속할 수 있어요.')
      return
    }

    if (!zoneOf(point)) {
      setStatus('unavailable')
      setNotice('부산 원도심·영도 권역 밖이에요. 여행 모드에서 출발점을 골라 주세요.')
      return
    }

    const smoother = new HeadingSmoother(8)
    const aimableAt = Date.now() + AIM_GRACE_MS
    unsubscribeRef.current = subscribeHeading((deg) => {
      smoother.push(deg)
      const value = smoother.value
      if (value === null) return
      setHeading(value)
      setAimed(Date.now() >= aimableAt && smoother.isStable())
    })

    setOrigin(fieldOriginFrom(point))
    setStatus('on')
  }, [])

  return { status, heading, notice, origin, aimed, enable, disable }
}
