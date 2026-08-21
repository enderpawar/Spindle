/**
 * 열린 오버레이를 뒤로가기가 화면 이동보다 먼저 닫게 하는 LIFO 스택.
 *
 * 결과 카드의 갤러리·상세 시트, 명소 지도의 핀 시트, 코스 안내 단계 카드는 각 화면의
 * 로컬 상태라 App에서 닿을 수 없다. 상태를 위로 끌어올려 네 화면을 흔드는 대신
 * "닫는 방법"만 등록받는다.
 *
 * 모듈 스코프 배열에는 닫기 함수만 담기며 TourAPI 응답이나 화면 데이터를 담지 않는다
 * — 저장소가 아니다 (AGENTS.md 절대 원칙 3과 무관).
 */
interface BackGuardEntry {
  dismiss: () => void
}

const guards: BackGuardEntry[] = []

/**
 * 가드를 등록하고 해제 함수를 돌려준다.
 *
 * 함수가 아니라 **항목 객체의 동일성**으로 지운다 — StrictMode가 같은 `dismiss`를
 * 두 번 등록해도 각 등록이 자기 항목만 정확히 제거한다.
 */
export function pushBackGuard(dismiss: () => void): () => void {
  const entry: BackGuardEntry = { dismiss }
  guards.push(entry)
  return () => {
    const index = guards.indexOf(entry)
    if (index !== -1) guards.splice(index, 1)
  }
}

/**
 * 최상단 가드를 실행했으면 true, 열린 오버레이가 없으면 false.
 *
 * 실행 **전에** 스택에서 빼낸다. 보통은 `dismiss`가 상태를 바꿔 훅 cleanup이 알아서
 * 해제하지만, 어떤 이유로 상태가 바뀌지 않더라도 사용자가 뒤로가기에 갇히지 않는다.
 */
export function runTopBackGuard(): boolean {
  const entry = guards.pop()
  if (!entry) return false
  entry.dismiss()
  return true
}

/** 테스트 전용 — 등록된 가드 수. */
export function backGuardCount(): number {
  return guards.length
}

/** 테스트 전용 — 스택 초기화. */
export function clearBackGuards(): void {
  guards.length = 0
}
