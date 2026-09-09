import { describe, expect, it } from 'vitest'
import html from '../../public/privacy.html?raw'
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_SECTIONS,
  PRIVACY_TITLE,
} from './privacyPolicy'

/**
 * 같은 방침이 두 곳에 있다 — 앱 시트가 읽는 이 모듈과, 스토어에 등록된 공개 URL의
 * 실체인 public/privacy.html. 한쪽만 고치면 심사 자료와 앱 화면이 조용히 갈라지므로
 * npm run check에서 여기서 막는다.
 */

/** 태그·엔티티를 걷어내고 공백을 한 칸으로 눌러 본문 문자열만 남긴다. */
const plainText = html
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim()

describe('개인정보처리방침 본문', () => {
  it('제목·시행일자·문의처가 public/privacy.html과 같다', () => {
    expect(plainText).toContain(PRIVACY_TITLE)
    expect(plainText).toContain('시행일자: ' + PRIVACY_EFFECTIVE_DATE)
    expect(plainText).toContain('문의: ' + PRIVACY_CONTACT_EMAIL)
  })

  it.each(PRIVACY_SECTIONS.map((section) => [section.heading, section] as const))(
    '%s 의 모든 문장이 public/privacy.html에 그대로 있다',
    (_heading, section) => {
      expect(plainText).toContain(section.heading)

      for (const block of section.blocks) {
        if (block.kind === 'p') {
          expect(plainText).toContain(block.text)
        } else if (block.kind === 'list') {
          for (const item of block.items) {
            expect(plainText).toContain(item.lead ? item.lead + ' ' + item.text : item.text)
          }
        }
      }
    },
  )

  // AGENTS.md 절대 원칙 6 — 스토어 제출용 공개 문서에는 출처가 텍스트로 남아 있어야 한다.
  // (앱 시트에는 넣지 않는다 — privacyPolicy.ts 주석 참고)
  it('public/privacy.html은 출처 표기를 유지한다', () => {
    expect(plainText).toContain('출처: ⓒ한국관광공사')
  })
})
