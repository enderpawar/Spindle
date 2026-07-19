import { describe, expect, it } from 'vitest'
import { sectorOf } from './compass'
import { seededRng } from './rng'
import { recommendFromSpin } from './spinRecommend'
import { DEPARTURES, DIAL_STEPS } from '../mock/pois'

const busanStation = DEPARTURES[0] // 부산역 (북)
const yeongdo = DEPARTURES[2] // 영도 흰여울 (남)

function ids(cands: { contentId: string }[]) {
  return cands.map((c) => c.contentId)
}

describe('recommendFromSpin — 스핀 배선', () => {
  it('화면용 Recommendation 형태로 반환한다 (방위=스핀 섹터, 후보 비지 않음)', () => {
    const rec = recommendFromSpin({ heading: 90, departure: busanStation, budgetMinutes: Infinity, rng: seededRng(1) })
    expect(rec.direction.id).toBe(sectorOf(90)) // 'E'
    expect(rec.candidates.length).toBeGreaterThan(0)
    for (const c of rec.candidates) {
      expect(c.contentId).toMatch(/^\d+$/)
      expect(c.name.length).toBeGreaterThan(0)
      expect(Number.isInteger(c.walkMinutes)).toBe(true)
      expect(c.walkMinutes).toBeGreaterThanOrEqual(1)
    }
  })

  it('시드가 같으면 결과가 재현된다', () => {
    const a = recommendFromSpin({ heading: 45, departure: busanStation, budgetMinutes: 40, rng: seededRng(7) })
    const b = recommendFromSpin({ heading: 45, departure: busanStation, budgetMinutes: 40, rng: seededRng(7) })
    expect(ids(a.candidates)).toEqual(ids(b.candidates))
    expect(a.candidates.map((c) => c.walkMinutes)).toEqual(b.candidates.map((c) => c.walkMinutes))
  })

  it('출발점이 결과를 바꾼다 (방위는 출발점 기준으로 계산)', () => {
    const from1 = recommendFromSpin({ heading: 180, departure: busanStation, budgetMinutes: Infinity, rng: seededRng(3) })
    const from2 = recommendFromSpin({ heading: 180, departure: yeongdo, budgetMinutes: Infinity, rng: seededRng(3) })
    // 후보 목록 또는 보정 도보시간이 출발점에 따라 달라야 한다
    const sameIds = JSON.stringify(ids(from1.candidates)) === JSON.stringify(ids(from2.candidates))
    const sameMinutes =
      JSON.stringify(from1.candidates.map((c) => c.walkMinutes)) ===
      JSON.stringify(from2.candidates.map((c) => c.walkMinutes))
    expect(sameIds && sameMinutes).toBe(false)
  })

  it('예산 20분은 확장이 없으면 모든 후보가 20분 이내다', () => {
    for (const departure of DEPARTURES) {
      for (let heading = 0; heading < 360; heading += 45) {
        const rec = recommendFromSpin({ heading, departure, budgetMinutes: 20, rng: seededRng(heading + 1) })
        if (!rec.expandReason) {
          for (const c of rec.candidates) expect(c.walkMinutes).toBeLessThanOrEqual(20)
        }
      }
    }
  })

  it('모든 방위·출발점·다이얼 눈금 조합에서 항상 후보가 최소 1곳 (시연 데드엔드 없음)', () => {
    for (const departure of DEPARTURES) {
      for (const budgetMinutes of DIAL_STEPS) {
        for (let heading = 0; heading < 360; heading += 45) {
          const rec = recommendFromSpin({ heading, departure, budgetMinutes, rng: seededRng(heading + 5) })
          expect(rec.candidates.length, `${departure.id}/${budgetMinutes}/${heading}`).toBeGreaterThan(0)
        }
      }
    }
  })
})
