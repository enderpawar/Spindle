import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BottomNav } from './BottomNav'

describe('BottomNav', () => {
  it('화면 컨테이너 높이와 무관하게 뷰포트 최하단에 고정된다', () => {
    const markup = renderToStaticMarkup(
      <BottomNav active="home" onNavigate={() => undefined} />,
    )

    expect(markup).toContain('position:fixed')
    expect(markup).toContain('bottom:0')
    expect(markup).toContain('left:50%')
    expect(markup).toContain('width:100%')
    expect(markup).toContain('max-width:480px')
    expect(markup).toContain('transform:translateX(-50%)')
    expect(markup).toContain('env(safe-area-inset-bottom)')
  })
})
