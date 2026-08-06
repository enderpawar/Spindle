import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BottomNav } from './BottomNav'

// 레이아웃 회귀는 실기기 육안 확인 대상이다.
describe('BottomNav', () => {
  it('뷰포트 기준 fixed·480px 중앙 정렬·safe area 패딩 스타일을 유지한다', () => {
    const markup = renderToStaticMarkup(
      <BottomNav active="home" onNavigate={() => undefined} />,
    )

    expect(markup).toContain('position:fixed')
    // iOS standalone이 짧게 보고한 뷰포트만큼 실측값으로 다시 내려 화면 바닥에 밀착시킨다.
    expect(markup).toContain('bottom:calc(var(--app-bottom-gap, 0px) * -1)')
    expect(markup).toContain('left:50%')
    expect(markup).toContain('width:100%')
    expect(markup).toContain('max-width:480px')
    expect(markup).toContain('transform:translateX(-50%)')
    expect(markup).toContain('env(safe-area-inset-bottom)')
  })
})
