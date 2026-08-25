import type { CSSProperties } from 'react'
import { kakaoMapMobileSearchUrl } from '../lib/mapLinks'

interface Props {
  /** 폴백을 안내할 장소명 — 코스 전체 링크에서는 1번 장소를 쓴다 */
  placeName: string
  /** 사용자가 카카오맵 링크를 실제로 누른 뒤에만 보여 준다 */
  visible: boolean
  style?: CSSProperties
}

/**
 * 카카오맵 길찾기가 열리지 않았을 때의 두 번째 길 (R3).
 *
 * `map.kakao.com/link/*`는 모바일에서 앱을 먼저 띄우려 하므로, 앱이 없거나 브라우저가 새 탭을
 * 막으면 화면에 아무 변화가 없다. 그 실패를 코드로 감지할 방법이 없다 — Capacitor WebView는
 * `window.open`이 항상 null을 돌려주면서도 실제로는 인텐트로 잘 열리기 때문에, 반환값으로
 * 실패를 판정하면 정상 동작에도 오탐이 난다. 그래서 감지하지 않고, **누른 뒤에 조용한 한 줄로만**
 * 카카오 모바일 웹 경로를 열어 둔다. 누르기 전에는 보이지 않으므로 평소 화면은 그대로다.
 */
export function MapFallbackNote({ placeName, visible, style }: Props) {
  if (!visible) return null
  return (
    <p aria-live="polite" style={{ margin: '8px 0 0', fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, color: 'var(--l-ink-3)', ...style }}>
      카카오맵이 열리지 않았나요?{' '}
      <a
        href={kakaoMapMobileSearchUrl(placeName)}
        target="_blank"
        rel="noreferrer"
        style={{ color: 'var(--l-primary)', fontWeight: 800, textDecoration: 'underline' }}
      >
        모바일 웹으로 열기
      </a>
    </p>
  )
}
