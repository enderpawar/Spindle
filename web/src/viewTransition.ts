import { flushSync } from 'react-dom'
import type { TransitionIntent } from './navigationMotion'

interface NativeViewTransition {
  finished: Promise<void>
  ready?: Promise<void>
  skipTransition?: () => void
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => NativeViewTransition
}

let activeTransition = 0
let current: NativeViewTransition | null = null

/** 네이티브 화면 스냅샷 전환. 미지원·모션 최소화 환경에서는 동기 상태 갱신으로 폴백한다. */
export function runViewTransition(intent: TransitionIntent, update: () => void): void {
  const doc = document as ViewTransitionDocument
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduceMotion) {
    update()
    return
  }

  // 빠른 연속 내비게이션에서 이전 전환이 아직 살아 있으면 즉시 끝내 겹침을 막는다
  // (겹치면 이전 전환이 스킵되며 InvalidStateError·재깜빡임이 발생).
  current?.skipTransition?.()

  const transitionId = ++activeTransition
  document.documentElement.dataset.viewTransition = intent

  try {
    const transition = doc.startViewTransition(() => flushSync(update))
    current = transition
    const cleanup = () => {
      if (current === transition) current = null
      if (transitionId === activeTransition) delete document.documentElement.dataset.viewTransition
    }
    // 이전 전환이 스킵되며 ready가 reject돼도 미처리 예외로 콘솔에 잡히지 않게 흡수한다.
    transition.ready?.catch(() => {})
    void transition.finished.then(cleanup, cleanup)
  } catch {
    current = null
    delete document.documentElement.dataset.viewTransition
    update()
  }
}
