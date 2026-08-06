import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const mobileCss = readFileSync(new URL('../src/mobile-pwa.css', import.meta.url), 'utf8')

describe('iPhone PWA mobile layout contract', () => {
  it('하단 내비게이션 화면의 Home Indicator inset를 흰색으로 이어 붙인다', () => {
    expect(mobileCss).toMatch(/html:has\(\.bottom-nav\),\s*body:has\(\.bottom-nav\)\s*{\s*background:\s*#fff;/)
  })

  it('앱 프레임이 iOS standalone의 하단 죽은 띠만큼 늘어난다', () => {
    expect(mobileCss).toMatch(/#root\s*{[^}]*height:\s*calc\(100% \+ var\(--app-bottom-gap, 0px\)\);/s)
  })

  it('명소 상세 시트가 내비게이션 위에서 멈추고 독립적으로 세로 스크롤된다', () => {
    expect(mobileCss).toMatch(/\.spot-sheet\s*{[^}]*--sheet-space:\s*calc\(100% - var\(--nav-h/s)
    expect(mobileCss).toMatch(/\.spot-sheet\s*{[^}]*max-height:\s*var\(--sheet-space\);/s)
    expect(mobileCss).toMatch(/\.spot-sheet\s*{[^}]*overflow-y:\s*auto;/s)
    expect(mobileCss).toMatch(/\.spot-sheet\s*{[^}]*touch-action:\s*pan-y;/s)
    expect(mobileCss).toMatch(/\.spot-sheet__photo\s*{[^}]*flex:\s*0 0 clamp\(/s)
  })
})
