/**
 * 흔들기 스핀 — 휴대폰을 흔드는 동안 원판이 계속 돌게 하는 입력 소스 (PLAN Phase 4 연장선).
 *
 * 가속도 표본은 이 훅과 `motion.ts` 안에서만 살아 있고 네트워크·로그·영속 저장소로 나가지 않는다
 * (AGENTS.md 절대 원칙 1). 흔들기를 못 쓰는 기기·권한 거부 상황에서도 드래그 스핀이 그대로
 * 남으므로 여행 모드 동선은 항상 완전 동작한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { isMotionSupported, motionNeedsPermission, requestMotionPermission, subscribeShake } from './motion'

export type ShakeStatus = 'off' | 'requesting' | 'on' | 'unavailable'

export interface ShakeSpin {
  status: ShakeStatus
  /** iOS처럼 사용자가 직접 켜야 하는 환경인가 — 켜기 버튼 노출 판단용 */
  needsPermission: boolean
  /** 실패 사유 — 사용자에게 그대로 보여줄 문장 */
  notice: string | null
  enable: () => Promise<void>
}

export function useShakeSpin(onShake: (energy: number) => void): ShakeSpin {
  const [supported] = useState(isMotionSupported)
  const [needsPermission] = useState(motionNeedsPermission)
  const [status, setStatus] = useState<ShakeStatus>('off')
  const [notice, setNotice] = useState<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // 콜백이 바뀌어도 재구독하지 않는다 — 재구독은 가속도 표본 이력을 끊어 첫 세기를 흘린다.
  const onShakeRef = useRef(onShake)
  useEffect(() => {
    onShakeRef.current = onShake
  }, [onShake])

  const subscribe = useCallback(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = subscribeShake((energy) => onShakeRef.current(energy))
    setStatus('on')
  }, [])

  // 권한 개념이 없는 환경(안드로이드·데스크톱)은 화면에 들어오면 바로 켠다.
  useEffect(() => {
    if (!supported || needsPermission) return
    subscribe()
    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [needsPermission, subscribe, supported])

  // 언마운트 시 구독 해제 — 스핀 화면을 떠나면 가속도를 더 읽지 않는다.
  useEffect(
    () => () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    },
    [],
  )

  const enable = useCallback(async () => {
    setNotice(null)
    setStatus('requesting')

    // iOS는 사용자 제스처 안에서 권한을 요청해야 한다 — enable()이 onClick에서 바로 호출된다.
    const permission = await requestMotionPermission()
    if (permission !== 'granted') {
      setStatus('unavailable')
      setNotice(
        permission === 'denied'
          ? '동작 센서 권한이 거부돼 흔들기로는 돌릴 수 없어요. 원판을 손가락으로 돌리면 똑같이 동작해요.'
          : '이 기기에서는 흔들기를 읽을 수 없어요. 원판을 손가락으로 돌려 주세요.',
      )
      return
    }

    subscribe()
  }, [subscribe])

  return { status, needsPermission, notice, enable }
}
