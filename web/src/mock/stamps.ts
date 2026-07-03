export interface StampSlot {
  name: string | null
}

export interface ZoneStamps {
  id: string
  label: string
  collected: number
  total: number
  slots: StampSlot[]
}

export const zones: ZoneStamps[] = [
  {
    id: 'yeongdo',
    label: '영도구',
    collected: 3,
    total: 8,
    slots: [
      { name: '흰여울마을' },
      { name: '깡깡이마을' },
      { name: '태종대' },
      { name: null },
      { name: null },
      { name: null },
    ],
  },
  { id: 'dong', label: '동구', collected: 0, total: 6, slots: [] },
  { id: 'seo', label: '서구', collected: 0, total: 5, slots: [] },
  { id: 'jung', label: '중구', collected: 0, total: 7, slots: [] },
]
