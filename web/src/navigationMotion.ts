export type Screen = 'onboarding' | 'home' | 'spots' | 'spin' | 'stamp' | 'settings' | 'departure' | 'reveal' | 'result' | 'course' | 'share' | 'theme' | 'festival'
export type TransitionIntent = 'tab' | 'forward' | 'back' | 'ritual'

const TABS = new Set<Screen>(['home', 'spots', 'spin', 'stamp', 'settings'])
const RITUAL_EDGES = new Set(['spin>reveal', 'reveal>result'])
const BACK_EDGES = new Set([
  'departure>home',
  'departure>spin',
  'departure>settings',
  'result>home',
  'result>spots',
  'result>spin',
  'result>theme',
  'course>result',
  'course>spin',
  'share>result',
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
