/**
 * 흔들기 스핀 — 휴대폰을 흔드는 동안 원판이 계속 돌게 하는 입력 소스 (PLAN Phase 4 연장선).
 *
 * 가속도 표본은 이 훅과 `motion.ts` 안에서만 살아 있고 네트워크·로그·영속 저장소로 나가지 않는다
 * (AGENTS.md 절대 원칙 1). 흔들기를 못 쓰는 기기·권한 거부 상황에서도 드래그 스핀이 그대로
 * 남으므로 여행 모드 동선은 항상 완전 동작한다.
 *
 * 켜는 방식은 기기에 따라 다르다.
 * - 권한 개념이 없는 환경(안드로이드·데스크톱): 스핀 화면에 들어오면 바로 켠다.
 * - 네이티브 셸: 즉시 구독하고 실제 표본이 오지 않을 때만 아래 권한 요청 경로로 되돌아간다.
 * - iOS 13+ 브라우저: 권한을 사용자 제스처 안에서만 물을 수 있어, 별도 버튼을 두는 대신 스핀 화면에서
 *   일어나는 **첫 조작(탭·드래그·키 입력)** 에 요청을 얹는다. 화면에 들어와 아무거나 한 번
 *   건드리면 그때 프롬프트가 뜨고, 허용 이후로는 그냥 흔들기만 하면 된다.
 *   (명시적 버튼을 다시 두고 싶으면 `enable()`을 onClick에 걸면 된다 — 옵션은 열어 둔다)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { isNativeShell } from '../native/shell'
import {
  isMotionSupported,
  knownMotionPermission,
  motionNeedsPermission,
  requestMotionPermission,
  subscribeShake,
} from './motion'

export type ShakeStatus = 'off' | 'requesting' | 'on' | 'unavailable'

export interface ShakeSpin {
  status: ShakeStatus
  /** iOS처럼 권한을 사용자 제스처 안에서 물어야 하는 환경인가 */
  needsPermission: boolean
  /** 실패 사유 — 사용자에게 그대로 보여줄 문장 */
  notice: string | null
  /** 명시적 트리거(버튼 등)를 붙이고 싶을 때 쓰는 수동 진입점 */
  enable: () => Promise<void>
}

// devicemotion은 보통 수십 Hz로 오므로 정지 상태여도 1.2초면 여러 표본이 도착한다.
// 이 시간 동안 한 건도 없으면 WKWebView의 권한 경로가 막힌 것으로 보고 제스처 요청으로 폴백한다.
export const NATIVE_MOTION_SAMPLE_WAIT_MS = 1_200

/** 하단 내비게이션 탭처럼 화면을 떠나는 조작에는 권한 프롬프트를 얹지 않는다 */
function leavesScreen(target: EventTarget | null): boolean {
  return typeof Element !== 'undefined' && target instanceof Element && target.closest('nav') !== null
}

interface ShakeActivationOptions {
  supported: boolean
  needsPermission: boolean
  knownPermission: () => ReturnType<typeof knownMotionPermission>
  subscribe: (onSample?: () => void) => void
  stop: () => void
  enable: () => Promise<void>
  setStatus: (status: ShakeStatus) => void
}

/** 훅의 화면 진입/이탈 수명주기. DOM 렌더러 없이 권한 전환을 회귀 테스트할 수 있게 분리한다. */
export function installShakeActivation({
  supported,
  needsPermission,
  knownPermission,
  subscribe,
  stop,
  enable,
  setStatus,
}: ShakeActivationOptions): () => void {
  if (!supported) return () => {}

  let sampleTimer: ReturnType<typeof setTimeout> | undefined
  let detached = false

  const arm = (event: Event) => {
    if (leavesScreen(event.target)) return
    detach()
    void enable()
  }
  const detach = () => {
    if (detached) return
    detached = true
    window.removeEventListener('pointerup', arm, true)
    window.removeEventListener('keydown', arm, true)
  }
  const armPermission = () => {
    detached = false
    window.addEventListener('pointerup', arm, true)
    window.addEventListener('keydown', arm, true)
  }
  const enterPermissionPath = () => {
    const known = knownPermission()
    if (known === 'granted') {
      subscribe()
      return
    }
    if (known !== null) {
      setStatus('unavailable')
      return
    }
    armPermission()
  }

  if (isNativeShell()) {
    let sampled = false
    subscribe(() => {
      sampled = true
      if (sampleTimer !== undefined) {
        clearTimeout(sampleTimer)
        sampleTimer = undefined
      }
    })
    sampleTimer = setTimeout(() => {
      sampleTimer = undefined
      if (sampled || !needsPermission) return
      stop()
      setStatus('off')
      enterPermissionPath()
    }, NATIVE_MOTION_SAMPLE_WAIT_MS)
  } else if (!needsPermission) {
    subscribe()
  } else {
    enterPermissionPath()
  }

  return () => {
    if (sampleTimer !== undefined) clearTimeout(sampleTimer)
    detach()
    stop()
  }
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

  const subscribe = useCallback((onSample?: () => void) => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = subscribeShake((energy) => onShakeRef.current(energy), onSample)
    setStatus('on')
  }, [])

  const enable = useCallback(async () => {
    setNotice(null)
    setStatus('requesting')

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

  useEffect(() => {
    const stop = () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
    return installShakeActivation({
      supported,
      needsPermission,
      knownPermission: knownMotionPermission,
      subscribe,
      stop,
      enable,
      setStatus,
    })
  }, [enable, needsPermission, subscribe, supported])

  return { status, needsPermission, notice, enable }
}
