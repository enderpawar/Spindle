import { describe, expect, it } from 'vitest'
import { overviewExcerpt } from './overviewExcerpt'

describe('overviewExcerpt', () => {
  it('목표 길이가 될 때까지 문장을 순서대로 담는다', () => {
    expect(overviewExcerpt('첫 문장. 둘째 문장. 셋째 문장.', 10)).toBe('첫 문장. 둘째 문장.')
  })

  it('최대 문장 수를 넘기지 않는다', () => {
    expect(overviewExcerpt('하나. 둘. 셋. 넷.', 100, 160, 3)).toBe('하나. 둘. 셋.')
  })

  it('최대 길이를 넘으면 말줄임한다', () => {
    const excerpt = overviewExcerpt('가'.repeat(200), 90, 40)
    expect(excerpt).toHaveLength(40)
    expect(excerpt.endsWith('…')).toBe(true)
  })

  it('짧은 소개는 그대로 유지한다', () => {
    expect(overviewExcerpt('골목 끝에서 바다를 만나요.')).toBe('골목 끝에서 바다를 만나요.')
  })
})
