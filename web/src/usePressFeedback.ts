import { useEffect } from 'react'

const PRESS_TARGET = 'button, a[href], [role="button"], .motion-card'
const MIN_PRESS_MS = 110

interface ActivePress {
  element: HTMLElement
  startedAt: number
  token: number
}

/** 빠른 Chrome 클릭에서도 눌림 프레임이 보이도록 최소 유지 시간을 계산한다. */
export function remainingPressMs(elapsedMs: number): number {
  return Math.max(0, MIN_PRESS_MS - elapsedMs)
}

function pressTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const element = target.closest<HTMLElement>(PRESS_TARGET)
  if (!element || element.matches(':disabled, [aria-disabled="true"]')) return null
  return element
}

/** :active보다 오래 유지되는 명시적 press 상태를 포인터·키보드 입력에 공통 적용한다. */
export function usePressFeedback(): void {
  useEffect(() => {
    let nextToken = 0
    const pointerPresses = new Map<number, ActivePress>()
    const keyboardPresses = new Map<HTMLElement, ActivePress>()
    const latestToken = new WeakMap<HTMLElement, number>()
    const pressedElements = new Set<HTMLElement>()
    const timers = new Set<number>()

    const begin = (element: HTMLElement): ActivePress => {
      const token = ++nextToken
      const press = { element, startedAt: performance.now(), token }
      latestToken.set(element, token)
      pressedElements.add(element)
      element.classList.add('is-pressing')
      return press
    }

    const end = (press: ActivePress) => {
      const delay = remainingPressMs(performance.now() - press.startedAt)
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        if (latestToken.get(press.element) !== press.token) return
        press.element.classList.remove('is-pressing')
        pressedElements.delete(press.element)
      }, delay)
      timers.add(timer)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const element = pressTarget(event.target)
      if (!element) return
      pointerPresses.set(event.pointerId, begin(element))
    }

    const onPointerEnd = (event: PointerEvent) => {
      const press = pointerPresses.get(event.pointerId)
      if (!press) return
      pointerPresses.delete(event.pointerId)
      end(press)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
      const element = pressTarget(event.target)
      if (!element || keyboardPresses.has(element)) return
      keyboardPresses.set(element, begin(element))
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const element = pressTarget(event.target)
      if (!element) return
      const press = keyboardPresses.get(element)
      if (!press) return
      keyboardPresses.delete(element)
      end(press)
    }

    const onWindowBlur = () => {
      for (const press of pointerPresses.values()) end(press)
      for (const press of keyboardPresses.values()) end(press)
      pointerPresses.clear()
      keyboardPresses.clear()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerEnd, true)
    document.addEventListener('pointercancel', onPointerEnd, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onWindowBlur)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerEnd, true)
      document.removeEventListener('pointercancel', onPointerEnd, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onWindowBlur)
      for (const timer of timers) window.clearTimeout(timer)
      for (const element of pressedElements) element.classList.remove('is-pressing')
    }
  }, [])
}
