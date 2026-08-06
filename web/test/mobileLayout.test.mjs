import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const mobileCss = readFileSync(new URL('../src/mobile-pwa.css', import.meta.url), 'utf8')
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

describe('iPhone PWA mobile layout contract', () => {
  it('상태바를 반투명으로 두지 않는다 — 뷰포트가 화면보다 짧게 잡히는 원인', () => {
    expect(indexHtml).toMatch(/apple-mobile-web-app-status-bar-style"\s+content="default"/)
  })

  it('하단 내비게이션 화면의 Home Indicator inset를 흰색으로 이어 붙인다', () => {
    expect(mobileCss).toMatch(/html:has\(\.bottom-nav\),\s*body:has\(\.bottom-nav\)\s*{\s*background:\s*#fff;/)
  })

  it('앱 프레임을 뷰포트 밖으로 늘리지 않는다 (밖은 터치가 안 먹는다)', () => {
    expect(mobileCss).toMatch(/#root\s*{[^}]*inset:\s*0;/s)
    expect(mobileCss).not.toMatch(/--app-bottom-gap/)
  })

  it('명소 상세 시트가 내비게이션 위에서 멈추고 독립적으로 세로 스크롤된다', () => {
    expect(mobileCss).toMatch(/\.spot-sheet\s*{[^}]*--sheet-space:\s*calc\(100% - var\(--nav-h/s)
    expect(mobileCss).toMatch(/\.spot-sheet\s*{[^}]*max-height:\s*var\(--sheet-space\);/s)
    expect(mobileCss).toMatch(/\.spot-sheet\s*{[^}]*overflow-y:\s*auto;/s)
    expect(mobileCss).toMatch(/\.spot-sheet\s*{[^}]*touch-action:\s*pan-y;/s)
    expect(mobileCss).toMatch(/\.spot-sheet__photo\s*{[^}]*flex:\s*0 0 clamp\(/s)
  })
})
