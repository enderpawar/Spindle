export interface DailyMission {
  id: string
  title: string
  description: string
}

export const DAILY_MISSIONS: readonly DailyMission[] = [
  {
    id: 'trust-first-direction',
    title: '첫 방향을 믿어보기',
    description: '오늘은 첫 결과를 바꾸지 말고 천천히 살펴보세요.',
  },
  {
    id: 'add-twenty-minutes',
    title: '이동시간 20분 늘리기',
    description: '조금 더 먼 부산까지 후보를 넓혀보세요.',
  },
  {
    id: 'view-another-candidate',
    title: '같은 방향의 다른 후보 보기',
    description: '첫 장소와 같은 방향에 숨어 있는 곳도 만나보세요.',
  },
  {
    id: 'continue-as-course',
    title: '한 방향으로 코스 잇기',
    description: '마음에 든 장소에서 가까운 곳까지 이어보세요.',
  },
  {
    id: 'change-departure',
    title: '출발점을 바꿔보기',
    description: '부산역, 남포동, 영도 중 낯선 곳에서 시작해보세요.',
  },
  {
    id: 'save-todays-direction',
    title: '오늘의 방향 남기기',
    description: '추천 결과를 공유 카드로 저장해보세요.',
  },
  {
    id: 'find-unstamped-district',
    title: '도장이 없는 동네 찾기',
    description: '아직 만나지 못한 구가 나오는지 한 번 돌려보세요.',
  },
] as const

const DAY_MS = 24 * 60 * 60 * 1000

/** 단말의 로컬 달력 날짜를 UTC 일련번호로 바꿔 시간대·DST와 무관하게 하루씩 순환한다. */
export function dailyMissionFor(date: Date = new Date()): DailyMission {
  const localDay = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS)
  const index = ((localDay % DAILY_MISSIONS.length) + DAILY_MISSIONS.length) % DAILY_MISSIONS.length
  return DAILY_MISSIONS[index]
}
