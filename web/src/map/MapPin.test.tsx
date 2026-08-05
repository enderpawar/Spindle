import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MapClusterPin, MapPin } from './MapPin'

describe('MapPin', () => {
  it('큐레이션은 별, 일반 명소는 중앙 점으로 구분한다', () => {
    const curated = renderToStaticMarkup(
      <MapPin color="#5b7cb4" size={20} variant="curated" />,
    )
    const standard = renderToStaticMarkup(
      <MapPin color="#5b7cb4" size={20} variant="standard" />,
    )
    expect(curated).toContain('data-pin-variant="curated"')
    expect(curated).toContain('★')
    expect(standard).toContain('data-pin-variant="standard"')
    expect(standard).toContain('<circle')
  })

  it('선택해도 크기는 유지하고 선택 블루와 키라인만 바꾼다', () => {
    const selected = renderToStaticMarkup(
      <MapPin color="#5b7cb4" size={20} variant="curated" selected />,
    )
    expect(selected).toContain('width="20"')
    expect(selected).toContain('fill="#2f5cff"')
    expect(selected).toContain('stroke-width="1.8"')
  })

  it('혼잡·쾌적 의미 배지를 렌더링한다', () => {
    const busy = renderToStaticMarkup(
      <MapPin color="#5b7cb4" size={20} status="busy" />,
    )
    const good = renderToStaticMarkup(
      <MapPin color="#5b7cb4" size={20} status="good" />,
    )
    expect(busy).toContain('map-pin__status--busy')
    expect(busy).toContain('>!</span>')
    expect(good).toContain('map-pin__status--good')
    expect(good).toContain('>✓</span>')
  })

  it('코스 핀은 순번을 유지한다', () => {
    const course = renderToStaticMarkup(
      <MapPin color="#5b7cb4" size={26} order={3} variant="course" />,
    )
    expect(course).toContain('data-pin-variant="course"')
    expect(course).toContain('>3</text>')
  })
})

describe('MapClusterPin', () => {
  it('묶음 개수와 확대 동작을 접근성 이름으로 제공한다', () => {
    const cluster = renderToStaticMarkup(<MapClusterPin count={12} onClick={() => undefined} />)
    expect(cluster).toContain('aria-label="12개 명소 묶음, 확대해서 보기"')
    expect(cluster).toContain('<span>12</span>')
  })
})
