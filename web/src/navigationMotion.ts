/** 모든 화면. 런타임 목록으로 두어야 뒤로가기 목적지가 전부 정의됐는지 테스트할 수 있다. */
export const SCREENS = [
  'onboarding', 'home', 'spots', 'spin', 'stamp', 'settings', 'departure',
  'origin-pick', 'reveal', 'result', 'course', 'share', 'theme', 'festival',
] as const

export type Screen = (typeof SCREENS)[number]
export type TransitionIntent = 'tab' | 'forward' | 'back' | 'ritual'

const TABS = new Set<Screen>(['home', 'spots', 'spin', 'stamp', 'settings'])
const RITUAL_EDGES = new Set(['spin>reveal', 'reveal>result'])
const BACK_EDGES = new Set([
  'reveal>spin', // 하드웨어 뒤로가기로 의식에서 빠져나올 때 (앞으로 가는 연출로 보이면 안 된다)
  'departure>home',
  'departure>spin',
  'departure>settings',
  'origin-pick>departure',
  'origin-pick>home',
  'origin-pick>spin',
  'origin-pick>settings',
  'result>home',
  'result>spots',
  'result>spin',
  'result>theme',
  'course>result',
  'course>spin',
  'share>result',
  'theme>spin',
  'theme>home',
  'festival>home',
])

/** 화면 관계를 한곳에서 분류해 탭·드릴다운·복귀·스핀 의식의 모션 의미를 일관되게 유지한다. */
export function transitionFor(from: Screen, to: Screen): TransitionIntent {
  const edge = `${from}>${to}`
  if (RITUAL_EDGES.has(edge)) return 'ritual'
  if ((TABS.has(from) && TABS.has(to)) || (from === 'onboarding' && to === 'home')) return 'tab'
  if (BACK_EDGES.has(edge)) return 'back'
  return 'forward'
}
