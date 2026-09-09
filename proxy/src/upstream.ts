// 2026-09-06 실측에서 성공 응답은 대체로 0.4~0.6초였고 무응답은 타임아웃까지
// 이어졌다. 드문 3.9초 응답보다 빠른 복구를 택해 시도당 3초로 제한하고, 새 연결이
// 로드밸런서의 다른 서버에 붙도록 지연 없이 최대 3회 시도한다. 전체 9초 예산은
// 클라이언트의 10초 제한 전에 프록시 502가 도달하게 한다.
export const UPSTREAM_ATTEMPT_TIMEOUT_MS = 3_000;
export const UPSTREAM_MAX_ATTEMPTS = 3;
export const UPSTREAM_BUDGET_MS = 9_000;

/**
 * 요청 단위 마감시각 안에서 업스트림을 재시도한다.
 * 5xx와 fetch 예외만 일시 장애로 보고 재시도한다. 4xx는 요청 자체의 결정적 오류이고,
 * 2xx JSON은 resultCode와 무관하게 정상 응답이므로 다시 호출하지 않는다.
 */
export async function fetchUpstream(
  input: string | URL | Request,
  init: RequestInit = {},
  deadline = Date.now() + UPSTREAM_BUDGET_MS,
): Promise<Response> {
  for (let attempt = 0; attempt < UPSTREAM_MAX_ATTEMPTS; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    try {
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(Math.min(UPSTREAM_ATTEMPT_TIMEOUT_MS, remainingMs)),
      });
      if (response.status < 500) return response;
      await response.body?.cancel();
    } catch {
      // 타임아웃·네트워크 예외는 새 연결로 즉시 재시도한다. 시도 사이 지연은 없다.
    }
  }

  throw new Error("upstream unreachable");
}
