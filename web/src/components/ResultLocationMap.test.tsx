import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResultLocationMap, isMappablePoint, straightLineLabel } from './ResultLocationMap'
import { POI_POOL, type Departure } from '../mock/pois'

const NAMPO: Departure = { id: 'nampo', name: '남포동', desc: '원도심 한복판', lat: 35.0977, lon: 129.0301 }
const poi = POI_POOL[0]

describe('직선거리 표기', () => {
  it('1km 미만은 10m 단위로 반올림한다', () => {
    expect(straightLineLabel(0)).toBe('0m')
    expect(straightLineLabel(124)).toBe('120m')
    expect(straightLineLabel(999)).toBe('1000m')
  })

  it('1km 이상은 0.1km 단위로 쓴다', () => {
    expect(straightLineLabel(1000)).toBe('1.0km')
    expect(straightLineLabel(2460)).toBe('2.5km')
  })
})

describe('지도 표시 가능 좌표', () => {
  it('결측을 0으로 채운 좌표와 범위 밖 좌표를 거른다', () => {
    expect(isMappablePoint(0, 0)).toBe(false)
    expect(isMappablePoint(Number.NaN, 129.03)).toBe(false)
    expect(isMappablePoint(95, 129.03)).toBe(false)
    expect(isMappablePoint(35.0977, 200)).toBe(false)
  })

  it('부산 원도심 좌표는 통과시킨다', () => {
    expect(isMappablePoint(NAMPO.lat, NAMPO.lon)).toBe(true)
  })
})

describe('ResultLocationMap', () => {
  it('추천에 사용한 기준점 이름과 방위·직선거리를 함께 알린다', () => {
    const markup = renderToStaticMarkup(<ResultLocationMap poi={poi} departure={NAMPO} />)

    expect(markup).toContain('여기에 있어요')
    expect(markup).toContain('남포동 기준')
    expect(markup).toContain('직선')
    // 도보 경로가 아니라 방향 표시임을 밝힌다.
    expect(markup).toContain('점선은 방향 표시예요')
  })

  it('지도는 잠긴 채로 열려 세로 스와이프를 결과 카드 스크롤에 넘긴다', () => {
    const markup = renderToStaticMarkup(<ResultLocationMap poi={poi} departure={NAMPO} />)

    // data-locked가 붙어 있는 동안만 touch-action:pan-y 규칙이 걸린다 (index.css).
    expect(markup).toContain('data-locked="true"')
    expect(markup).not.toContain('지도 잠그기')
  })

  it('좌표가 없는 장소는 지도 대신 안내 문구를 보여준다', () => {
    const markup = renderToStaticMarkup(
      <ResultLocationMap poi={{ ...poi, lat: 0, lon: 0 }} departure={NAMPO} />,
    )

    expect(markup).toContain('좌표가 없어')
    expect(markup).not.toContain('점선은 방향 표시예요')
  })

  it('기준점 좌표가 깨졌을 때는 출발점 안내로 구분한다', () => {
    const markup = renderToStaticMarkup(
      <ResultLocationMap poi={poi} departure={{ ...NAMPO, lat: Number.NaN }} />,
    )

    expect(markup).toContain('출발점을 다시 선택')
    expect(markup).not.toContain('좌표가 없어')
  })
})
