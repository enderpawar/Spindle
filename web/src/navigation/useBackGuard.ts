import { useEffect, useRef } from 'react'
import { pushBackGuard } from './backGuards'

/**
 * 오버레이가 열려 있는 동안 하드웨어 뒤로가기를 가로채 닫는다.
 *
 * `dismiss`는 ref로 최신값을 보므로 `active`가 바뀔 때만 재등록된다 —
 * 렌더마다 스택을 흔들지 않는다. 웹에서는 리스너 자체가 없어 아무 영향이 없다.
 */
export function useBackGuard(active: boolean, dismiss: () => void): void {
  const dismissRef = useRef(dismiss)

  useEffect(() => {
    dismissRef.current = dismiss
  })

  useEffect(() => {
    if (!active) return
    return pushBackGuard(() => dismissRef.current())
  }, [active])
}
