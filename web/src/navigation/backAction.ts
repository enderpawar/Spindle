import type { Screen } from '../navigationMotion'

/**
 * 안드로이드 하드웨어 뒤로가기가 해야 할 일.
 * - `goTo`: 화면 스택을 한 칸 거슬러 이동
 * - `confirmExit`: 더 갈 곳이 없다 — 한 번 더 누르면 종료
 */
export type BackAction =
  | { kind: 'goTo'; screen: Screen }
  | { kind: 'confirmExit' }

/** App이 들고 있는 "어디서 왔는가" 상태 — 각 화면의 onBack이 쓰는 값과 같다. */
export interface BackContext {
  screen: Screen
  departureReturn: Screen
  poiReturn: Screen
  courseReturn: Screen
  themeReturn: Screen
}

/**
 * 화면별 뒤로가기 목적지. 기존 `onBack` 프롭의 목적지를 그대로 옮기고,
 * back 경로가 아예 없던 곳(탭 4종·reveal·온보딩)만 채운다.
 *
 * 탭 이동 이력은 쌓지 않는다 — 홈→명소→스핀에서 뒤로가면 명소가 아니라 홈으로 간다.
 * 이력 스택을 새로 도입하지 않아 기존 화면 전환 규칙에 회귀가 없다.
 *
 * `transitionFor`(navigationMotion.ts)와 같은 순수 함수라 그대로 단위 테스트한다.
 */
export function backActionFor(ctx: BackContext): BackAction {
  const target = backTargetOf(ctx)
  if (target === null) return { kind: 'confirmExit' }
  // 복귀 지점이 어떤 이유로 현재 화면과 같아지면 goTo가 아무 일도 하지 않아
  // "눌러도 반응이 없는" 상태가 된다. 그럴 땐 홈으로 떨어뜨린다.
  return { kind: 'goTo', screen: target === ctx.screen ? 'home' : target }
}

/** 복귀할 화면. null이면 더 갈 곳이 없다는 뜻. */
function backTargetOf(ctx: BackContext): Screen | null {
  switch (ctx.screen) {
    // 스택 바닥 — 뒤에 아무것도 없다.
    case 'home':
    case 'onboarding':
      return null

    // 탭 화면: 지금은 onBack이 없어 뒤로가기가 곧바로 앱을 죽이는 구간이다.
    // 탭 이력은 쌓지 않고 시작 탭으로 모은다 (안드로이드 탭 앱의 일반 관습).
    case 'spots':
    case 'spin':
    case 'stamp':
    case 'settings':
      return 'home'

    case 'departure':
      return ctx.departureReturn
    // 지도로 출발점을 고르던 중이면 목록으로 돌아간다 (OriginPickScreen의 onBack과 동일).
    case 'origin-pick':
      return 'departure'
    // 리빌은 3초 뒤 결과로 자동 전환되는 연출 화면이라 back 경로가 없었다.
    // 뒤로가면 스핀으로 되돌리고, 언마운트가 자동 전환 타이머를 정리한다.
    case 'reveal':
      return 'spin'
    case 'result':
      return ctx.poiReturn
    case 'course':
      return ctx.courseReturn
    case 'share':
      return 'result'
    case 'theme':
      return ctx.themeReturn
    case 'festival':
      return 'home'

    default:
      return unhandledScreen(ctx.screen)
  }
}

/** Screen이 늘어나면 컴파일이 깨진다. 런타임에서는 홈으로 떨어뜨려 앱이 죽지 않게 한다. */
function unhandledScreen(screen: never): Screen {
  console.warn('[Spindle] 뒤로가기 목적지가 정의되지 않은 화면입니다.', screen)
  return 'home'
}
