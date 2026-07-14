import { describe, expect, it } from 'vitest'
import { buildCourseFromAnchor } from './spinCourse'
import { DEPARTURES, POI_POOL, type Poi } from '../mock/pois'

const nampo = DEPARTURES.find((d) => d.id === 'nampo')!
const poiOf = (contentId: string): Poi => POI_POOL.find((p) => p.contentId === contentId)!

describe('스핀 단일 추천 → 여행 코스 브리지', () => {
  it('보고 있던 장소를 첫 장소로 고정하고 2곳 이상 코스를 만든다', () => {
    const anchor = poiOf('132190') // 자갈치시장 (원도심 한복판)
    const course = buildCourseFromAnchor({ departure: nampo, dial: 'full', anchor })

    expect(course.status).toBe('ready')
    if (course.status !== 'ready') return
    expect(course.stops[0].poi.contentId).toBe(anchor.contentId)
    expect(course.stops[0].order).toBe(1)
    expect(course.stops.length).toBeGreaterThanOrEqual(2)
    // 같은 장소를 두 번 방문하지 않는다
    const ids = course.stops.map((s) => s.poi.contentId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('누적 이동시간은 순서를 따라 단조 증가한다', () => {
    const course = buildCourseFromAnchor({ departure: nampo, dial: 'full', anchor: poiOf('132190') })
    expect(course.status).toBe('ready')
    if (course.status !== 'ready') return
    for (let i = 1; i < course.stops.length; i++) {
      expect(course.stops[i].totalMinutes).toBeGreaterThanOrEqual(course.stops[i - 1].totalMinutes)
    }
    expect(course.totalMinutes).toBe(course.stops.at(-1)!.totalMinutes)
  })

  it('같은 입력이면 방문 순서가 재현된다(결정적)', () => {
    const build = () => buildCourseFromAnchor({ departure: nampo, dial: 'half', anchor: poiOf('132190') })
    const a = build()
    const b = build()
    expect(a).toEqual(b)
  })

  it('단일 추천의 확장 사유(noteReason)를 코스 사유에 유지한다', () => {
    const note = '이 방향은 바다예요. 범위를 넓혔어요'
    const course = buildCourseFromAnchor({ departure: nampo, dial: 'full', anchor: poiOf('132190'), noteReason: note })
    expect(course.status).toBe('ready')
    if (course.status !== 'ready') return
    expect(course.reasons).toContain(note)
  })

  it('이어 갈 장소가 부족하면 unavailable을 반환한다(단일 추천 유지)', () => {
    // 송도해수욕장은 존 연결이 없어 가볍게(20분)에서는 이어 갈 연결 후보가 없다.
    const course = buildCourseFromAnchor({ departure: nampo, dial: 'light', anchor: poiOf('126122') })
    expect(course.status).toBe('unavailable')
    if (course.status !== 'unavailable') return
    expect(course.reason).toBeTruthy()
  })
})
