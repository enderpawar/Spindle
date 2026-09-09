import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PrivacySheet } from './PrivacySheet'
import { PRIVACY_CONTACT_EMAIL, PRIVACY_SECTIONS } from '../content/privacyPolicy'

describe('PrivacySheet', () => {
  const markup = renderToStaticMarkup(<PrivacySheet onClose={() => undefined} />)

  it('방침 8개 절을 모두 앱 안에 렌더한다', () => {
    for (const section of PRIVACY_SECTIONS) {
      expect(markup).toContain(section.heading)
    }
  })

  it('닫기 수단과 문의 링크를 제공한다', () => {
    expect(markup).toContain('aria-label="닫기"')
    expect(markup).toContain('mailto:' + PRIVACY_CONTACT_EMAIL)
  })

  // 배경까지 버튼이면 같은 이름의 "닫기"가 스크린리더에 둘로 읽힌다.
  it('닫기라는 이름을 가진 컨트롤은 하나뿐이다', () => {
    expect(markup.split('aria-label="닫기"')).toHaveLength(2)
  })

  // 화면 프레임(.screen) 기준 오버레이여야 한다 — viewport 기준이면 iOS 홈화면 실행에서 어긋난다.
  it('화면 프레임 안에 갇히는 하단 시트다', () => {
    expect(markup).toContain('position:absolute')
    expect(markup).toContain('border-radius:24px 24px 0 0')
    expect(markup).toContain('env(safe-area-inset-bottom)')
    expect(markup).toContain('role="dialog"')
  })

  // 하단 내비(zIndex 20)에 마지막 절이 가리면 안 된다.
  it('하단 내비보다 위에 뜬다', () => {
    expect(markup).toContain('z-index:30')
  })
})
