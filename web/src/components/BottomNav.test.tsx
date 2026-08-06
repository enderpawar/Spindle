import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BottomNav } from './BottomNav'

// 레이아웃 회귀는 실기기 육안 확인 대상이다.
describe('BottomNav', () => {
  it('앱 프레임 기준 absolute·480px 중앙 정렬·safe area 패딩 스타일을 유지한다', () => {
    const markup = renderToStaticMarkup(
      <BottomNav active="home" onNavigate={() => undefined} />,
    )

    // 뷰포트(fixed) 기준이면 iOS 홈화면 실행에서 라벨이 화면 밖으로 잘린다.
    expect(markup).toContain('position:absolute')
    expect(markup).toContain('bottom:0')
    expect(markup).toContain('left:50%')
    expect(markup).toContain('width:100%')
    expect(markup).toContain('max-width:480px')
    expect(markup).toContain('transform:translateX(-50%)')
    expect(markup).toContain('env(safe-area-inset-bottom)')
  })
})
