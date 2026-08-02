import { describe, expect, it } from 'vitest'
import { DAILY_MISSIONS, dailyMissionFor } from './dailyMissions'

describe('dailyMissions', () => {
  it('같은 로컬 날짜에는 같은 미션을 반환한다', () => {
    const morning = new Date(2026, 7, 2, 8, 15)
    const night = new Date(2026, 7, 2, 23, 50)

    expect(dailyMissionFor(morning)).toEqual(dailyMissionFor(night))
  })

  it('다음 날짜에는 다음 미션으로 이동하고 7일 뒤 순환한다', () => {
    const first = new Date(2026, 7, 2)
    const next = new Date(2026, 7, 3)
    const weekLater = new Date(2026, 7, 9)

    expect(dailyMissionFor(next).id).not.toBe(dailyMissionFor(first).id)
    expect(dailyMissionFor(weekLater)).toEqual(dailyMissionFor(first))
  })

  it('미션 ID와 보이는 문구가 모두 유효하다', () => {
    expect(DAILY_MISSIONS).toHaveLength(7)
    expect(new Set(DAILY_MISSIONS.map((mission) => mission.id)).size).toBe(DAILY_MISSIONS.length)

    for (const mission of DAILY_MISSIONS) {
      expect(mission.title.trim()).not.toBe('')
      expect(mission.description.trim()).not.toBe('')
    }
  })
})
