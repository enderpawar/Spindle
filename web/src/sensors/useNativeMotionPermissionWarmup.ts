import { useEffect } from 'react'
import { isNativeShell } from '../native/shell'
import {
  knownMotionPermission,
  motionNeedsPermission,
  requestMotionPermission,
} from './motion'

/**
 * 네이티브 앱의 최초 pointerup에서 모션 권한을 미리 확정한다.
 * WKWebView는 제스처가 필요하지만 팝업은 띄우지 않으므로 하단 내비 탭도 제외하지 않는다.
 */
export function installNativeMotionPermissionWarmup(): () => void {
  if (
    typeof window === 'undefined' ||
    !isNativeShell() ||
    !motionNeedsPermission() ||
    knownMotionPermission() !== null
  ) {
    return () => {}
  }

  let attached = true
  const detach = () => {
    if (!attached) return
    attached = false
    window.removeEventListener('pointerup', requestOnFirstGesture, true)
  }
  const requestOnFirstGesture = () => {
    if (!attached) return
    detach()
    // 실패는 motion.ts에서 retryable로 남는다. 스핀 화면의 제스처 폴백이 다시 시도한다.
    void requestMotionPermission()
  }

  window.addEventListener('pointerup', requestOnFirstGesture, true)
  return detach
}

export function useNativeMotionPermissionWarmup(): void {
  useEffect(() => installNativeMotionPermissionWarmup(), [])
}
