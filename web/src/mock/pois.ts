export type CrowdLevel = 'quiet' | 'normal'

export interface SpinCard {
  id: string
  name: string
  category: string
  district: string
  crowd: CrowdLevel
  badge: string
  gradient: string
}

export const todaySpinCards: SpinCard[] = [
  {
    id: 'huinnyeoul',
    name: '흰여울문화마을',
    category: '관광명소',
    district: '영도구',
    crowd: 'quiet',
    badge: '북동 1.2km',
    gradient: 'linear-gradient(150deg,#5b93ff,#1e4fd8)',
  },
  {
    id: 'gamcheon',
    name: '감천문화마을',
    category: '문화·예술',
    district: '사하구',
    crowd: 'normal',
    badge: '서 2.4km',
    gradient: 'linear-gradient(150deg,#6a9bff,#2b5fd8)',
  },
]

export interface ResultPoi {
  id: string
  name: string
  category: string
  district: string
  directionLabel: string
  straightKm: number
  walkMinutes: number
  quietNow: boolean
  isPhotoSpot: boolean
  story: string
  reason: string
  stampZone: string
}

export const mockResult: ResultPoi = {
  id: 'huinnyeoul',
  name: '흰여울문화마을',
  category: '관광명소',
  district: '영도구',
  directionLabel: '북동 · 영도구',
  straightKm: 1.2,
  walkMinutes: 15,
  quietNow: true,
  isPhotoSpot: true,
  story:
    '파도소리 옆 좁은 산복도로 골목. 피란민이 터를 잡은 절벽마을이 지금은 부산에서 가장 그림 같은 바다 전망대가 됐어요.',
  reason: '도보 15분 · 지금 운영중 · 소멸위험 원도심의 숨은 명소라서 추천했어요.',
  stampZone: '영도',
}

export const compassLoop = ['서', '북서', '북동', '동', '남동'] as const
