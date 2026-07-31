import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CuratedCopy } from '../components/CuratedCopy'
import { COPY_BY_CONTENT_ID, copyOf } from './curation'

describe('추천 한 줄 큐레이션', () => {
  it('35곳 모두 40자 이내 자체 카피를 가진다', () => {
    expect(COPY_BY_CONTENT_ID.size).toBe(35)
    for (const copy of COPY_BY_CONTENT_ID.values()) {
      expect(copy.trim()).not.toBe('')
      expect([...copy].length).toBeLessThanOrEqual(40)
    }
  })

  it('큐레이션 POI는 결과 카드용 한 줄을 렌더링한다', () => {
    const markup = renderToStaticMarkup(<CuratedCopy contentId="132191" className="result-curation-copy" />)
    expect(markup).toContain(copyOf('132191'))
    expect(markup).toContain('result-curation-copy')
  })

  it('큐레이션에 없는 POI는 아무 요소도 추가하지 않는다', () => {
    expect(copyOf('not-curated')).toBeUndefined()
    expect(renderToStaticMarkup(<CuratedCopy contentId="not-curated" />)).toBe('')
  })
})
