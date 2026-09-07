/**
 * TourAPI 호출 유틸 — 항상 프록시(/api) 경유, 직접 호출 금지 (tourapi 스킬 규약).
 * 응답은 세션 범위 메모리 캐시(Map)에만 보관한다 — localStorage·IndexedDB 등
 * 영속 저장소 적재 금지 (AGENTS.md 절대 원칙 3).
 */
import { BUSAN_AREA_CODE, OLD_TOWN_REGIONS } from "./regionCodes";

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "/api";

/** tourapi 스킬 기본값 — 구별 POI 수를 감안해 충분히 크게 */
const NUM_OF_ROWS = 100;

type FetchLike = typeof fetch;

/**
 * 실패 원인. 사용자에게 보여줄 문구를 고르는 데만 쓴다 (api/failureCopy.ts).
 * 원격 전송·수집은 하지 않는다 (절대 원칙 5).
 */
export type TourApiFailureKind =
  | "offline" // 단말이 오프라인
  | "timeout" // 요청 타임아웃
  | "network" // 그 밖의 네트워크 실패 (DNS·차단 등)
  | "rateLimited" // TourAPI 호출 한도 초과 (HTTP 429)
  | "http" // 프록시/업스트림이 비정상 상태 코드로 응답
  | "api"; // 응답은 왔지만 TourAPI가 오류를 알림

export interface TourApiErrorOptions {
  kind?: TourApiFailureKind;
  resultCode?: string;
  status?: number;
}

export class TourApiError extends Error {
  readonly kind: TourApiFailureKind;
  readonly resultCode?: string;
  readonly status?: number;
  constructor(message: string, options: TourApiErrorOptions = {}) {
    super(message);
    this.name = "TourApiError";
    this.kind = options.kind ?? "api";
    this.resultCode = options.resultCode;
    this.status = options.status;
  }
}

/**
 * fetch가 던진 값에서 원인을 추린다.
 * `AbortSignal.timeout()`은 `TimeoutError` DOMException으로 reject하고,
 * 오프라인·DNS 실패는 보통 TypeError로 온다.
 */
function classifyFetchFailure(err: unknown): TourApiFailureKind {
  // navigator.onLine은 false일 때만 신뢰한다 — true여도 실제로는 끊겨 있을 수 있다
  // (components/AppErrorBoundary.tsx와 같은 판단).
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return "timeout";
  }
  return "network";
}

const FETCH_FAILURE_MESSAGES: Readonly<Record<string, string>> = {
  offline: "네트워크 연결 없음",
  timeout: "요청 시간 초과",
  network: "네트워크 요청 실패",
  rateLimited: "TourAPI 호출 한도 초과",
};

// ── 429 처리 ──
// TourAPI 트래픽은 오퍼레이션별로 집계된다 — 한 엔드포인트가 429를 내도 나머지는 멀쩡하다.
// 그래서 재시도도 쿨다운도 엔드포인트 단위로 건다.
//
// 429에는 성질이 다른 두 가지가 섞여 있다:
//   - 초당 호출 제한 → 잠깐 쉬면 풀린다. 짧은 지수 백오프로 넘긴다.
//   - 일일 트래픽 소진 → 재시도해도 안 풀린다. 계속 두드리면 나머지 호출까지 낭비하므로
//     쿨다운을 걸어 빠르게 실패시키고, 남은 예산을 사용자가 실제로 연 화면에 쓴다.
const RETRY_DELAYS_MS: readonly number[] = [600, 1_800];
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const RETRY_AFTER_CAP_MS = 30_000;
const rateLimitedUntil = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429의 `Retry-After`(초 또는 HTTP-date)를 ms로 읽는다. 없거나 해석 불가면 null. */
function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, RETRY_AFTER_CAP_MS);
  }
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return null;
  return Math.min(Math.max(at - Date.now(), 0), RETRY_AFTER_CAP_MS);
}

function rateLimitError(): TourApiError {
  return new TourApiError(FETCH_FAILURE_MESSAGES.rateLimited, {
    kind: "rateLimited",
    status: 429,
  });
}

/** 테스트·진단용 — 엔드포인트별 429 쿨다운을 지운다. */
export function resetRateLimitState(): void {
  rateLimitedUntil.clear();
}

/** TourAPI 응답 필드는 숫자·좌표 포함 전부 문자열로 온다 — 변환은 이 유틸로만 */
export function toNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** areaBasedList2 목록 아이템 중 사용 필드 (전부 문자열) */
export interface AreaPoi {
  contentid: string;
  contenttypeid: string;
  cat3?: string;
  title: string;
  addr1: string;
  firstimage: string;
  firstimage2?: string;
  sigungucode: string;
  mapx: string; // guard-allow: TourAPI 응답의 POI 경도 읽기 — 사용자 좌표 아님, 요청 파라미터로 쓰지 않음
  mapy: string; // guard-allow: TourAPI 응답의 POI 위도 읽기 — 단말 내 방향·거리 계산 전용
}

export interface ListBody<T> {
  items: { item: T | T[] } | "";
  numOfRows?: number | string;
  pageNo?: number | string;
  totalCount?: number | string;
}

interface TourApiEnvelope<B> {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: B;
  };
}

const REQUEST_TIMEOUT_MS = 10_000;

export async function callTourApi<B>(
  endpoint: string,
  params: Record<string, string>,
  fetchImpl: FetchLike,
): Promise<B> {
  // 이미 한도에 걸린 엔드포인트는 두드리지 않고 즉시 실패시킨다.
  if (Date.now() < (rateLimitedUntil.get(endpoint) ?? 0)) throw rateLimitError();

  const qs = new URLSearchParams(params);
  const url = `${API_BASE}/${endpoint}?${qs.toString()}`;

  for (let attempt = 0; ; attempt += 1) {
    let res: Response;
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      // 오프라인·타임아웃·차단을 구분해 실어 보낸다 — 에러 UI가 사유를 알려주고
      // 재시도 버튼을 띄운다 (빈 화면 금지).
      const kind = classifyFetchFailure(err);
      throw new TourApiError(FETCH_FAILURE_MESSAGES[kind], { kind });
    }

    if (res.status === 429) {
      if (attempt >= RETRY_DELAYS_MS.length) {
        // 재시도로도 안 풀렸다 = 초당 제한이 아니라 트래픽 소진에 가깝다.
        rateLimitedUntil.set(endpoint, Date.now() + RATE_LIMIT_COOLDOWN_MS);
        console.error(`TourAPI 호출 한도: ${endpoint} — ${RATE_LIMIT_COOLDOWN_MS}ms 쉬어갑니다`);
        throw rateLimitError();
      }
      // 지터를 섞어 동시에 튕긴 요청들이 같은 순간에 다시 몰리지 않게 한다.
      await sleep(retryAfterMs(res) ?? RETRY_DELAYS_MS[attempt] + Math.random() * 300);
      continue;
    }

    if (!res.ok) {
      throw new TourApiError(`프록시 응답 오류 (HTTP ${res.status})`, {
        kind: "http",
        status: res.status,
      });
    }

    const data = (await res.json()) as TourApiEnvelope<B>;
    const header = data.response?.header;
    const body = data.response?.body;
    if (header?.resultCode !== "0000" || body === undefined) {
      // 규약: resultCode !== "0000"이면 콘솔에 resultMsg 로깅 + 사용자 재시도 UI
      console.error("TourAPI 오류:", header?.resultCode, header?.resultMsg);
      throw new TourApiError(header?.resultMsg ?? "TourAPI 응답 형식 오류", {
        kind: "api",
        resultCode: header?.resultCode,
      });
    }
    return body;
  }
}

export function extractItems<T>(body: ListBody<T>): T[] {
  if (body.items === "" || body.items == null) return []; // 빈 결과는 items가 "" 로 온다
  const item = body.items.item;
  return Array.isArray(item) ? item : [item];
}

// 세션 시작 목록 호출(areaBasedList2)이 이미 실어 오는 필드를 contentId로 색인해 둔다.
// 메모리 전용 맵이라 탭이 닫히면 사라진다 (절대 원칙 3 — 영속화·정적 파일화 금지).
// 용도는 중복 호출 제거뿐이고, 값이 없으면 호출부가 기존 경로로 폴백하므로 표시 내용은
// 어느 쪽이든 동일하다.
//   - contentTypeId: detailIntro2를 detailCommon2와 병렬로 띄우는 데 사용
//   - firstimage: 썸네일이 detailCommon2(실측 4~5초)를 건너뛰고 바로 이미지를 띄우는 데 사용
const contentTypeIndex = new Map<string, string>();
const firstImageIndex = new Map<string, string>();
// 세션 메모리 전용 인덱스. 영속 저장하지 않는다 (절대 원칙 3).
const thumbImageIndex = new Map<string, string>();
const imageIndexListeners = new Set<() => void>();

function rememberContentTypeId(poi: AreaPoi): void {
  if (!poi.contentid) return;
  if (poi.contenttypeid) contentTypeIndex.set(poi.contentid, poi.contenttypeid);
  if (poi.firstimage) firstImageIndex.set(poi.contentid, poi.firstimage);
  if (poi.firstimage2) thumbImageIndex.set(poi.contentid, poi.firstimage2);
}

/** 세션 목록 호출로 이미 알고 있는 contentTypeId (모르면 undefined) */
export function getKnownContentTypeId(contentId: string): string | undefined {
  return contentTypeIndex.get(contentId);
}

/** 세션 목록 호출로 이미 알고 있는 대표 이미지 URL (모르면 undefined — 호출부가 상세로 폴백) */
export function getKnownFirstImage(contentId: string): string | undefined {
  return firstImageIndex.get(contentId);
}

/** 세션 목록 호출로 이미 알고 있는 경량 썸네일 URL (모르면 undefined) */
export function getKnownThumbImage(contentId: string): string | undefined {
  return thumbImageIndex.get(contentId);
}

/** 한 구의 POI 전체를 페이징으로 수집 */
export async function fetchAreaPois(
  sigunguCode: string,
  fetchImpl: FetchLike = fetch,
): Promise<AreaPoi[]> {
  const all: AreaPoi[] = [];
  let pageNo = 1;
  for (;;) {
    const body = await callTourApi<ListBody<AreaPoi>>(
      "areaBasedList2",
      {
        areaCode: BUSAN_AREA_CODE,
        sigunguCode,
        numOfRows: String(NUM_OF_ROWS),
        pageNo: String(pageNo),
      },
      fetchImpl,
    );
    const items = extractItems(body);
    for (const item of items) rememberContentTypeId(item);
    for (const listener of imageIndexListeners) listener();
    all.push(...items);
    const totalCount = toNumber(String(body.totalCount)) ?? 0;
    if (all.length >= totalCount || items.length === 0) return all;
    pageNo += 1;
  }
}

// 세션 범위 메모리 캐시 — 탭이 닫히면 사라진다. 영속화 금지 (절대 원칙 3).
const sessionCache = new Map<string, Promise<AreaPoi[]>>();

/**
 * 이미 시작된 구군 목록 호출만 기다린다. 호출 시점의 Promise 스냅샷을 사용하므로
 * 새 목록 요청을 만들지 않으며, 진행 중인 호출이 없으면 즉시 끝난다.
 * 필요한 장소가 한 페이지에 도착하면 isReady로 나머지 목록 대기를 종료한다.
 */
export async function whenAreaListsSettled(
  timeoutMs: number,
  isReady: () => boolean = () => false,
): Promise<void> {
  if (isReady()) return;
  const pending = [...sessionCache.values()];
  if (pending.length === 0) return;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let onIndexChange: (() => void) | undefined;
  await Promise.race([
    Promise.allSettled(pending).then(() => undefined),
    new Promise<void>((resolve) => {
      onIndexChange = () => { if (isReady()) resolve(); };
      imageIndexListeners.add(onIndexChange);
    }),
    new Promise<void>((resolve) => {
      timeoutId = setTimeout(resolve, Math.max(0, timeoutMs));
    }),
  ]);
  if (timeoutId !== undefined) clearTimeout(timeoutId);
  if (onIndexChange) imageIndexListeners.delete(onIndexChange);
}

/** 세션 캐시를 거치는 구별 POI 조회. 실패한 Promise는 캐시에서 제거해 재시도 가능하게 한다. */
export function fetchAreaPoisCached(
  sigunguCode: string,
  fetchImpl: FetchLike = fetch,
): Promise<AreaPoi[]> {
  const cached = sessionCache.get(sigunguCode);
  if (cached) return cached;
  const pending = fetchAreaPois(sigunguCode, fetchImpl).catch((err: unknown) => {
    sessionCache.delete(sigunguCode);
    throw err;
  });
  sessionCache.set(sigunguCode, pending);
  return pending;
}

/** 테스트용 — 세션 캐시 초기화 */
export function clearSessionCache(): void {
  sessionCache.clear();
  contentTypeIndex.clear();
  firstImageIndex.clear();
  thumbImageIndex.clear();
}

/**
 * POI 좌표를 숫자 GeoPoint로 변환 — TourAPI 원본 좌표 필드명은 이 함수 안에만 격리하고
 * 밖으로는 lat/lng로만 내보낸다. 좌표가 없거나 비정상인 POI는 방향 계산 불가로 제외.
 */
export function toEnginePoi(
  poi: AreaPoi,
): { contentId: string; title: string; point: { lat: number; lng: number } } | null {
  const lng = toNumber(poi.mapx); // guard-allow: 응답 좌표 파싱 (단말 내 계산 전용)
  const lat = toNumber(poi.mapy); // guard-allow: 응답 좌표 파싱 (단말 내 계산 전용)
  if (lng === undefined || lat === undefined) return null;
  return { contentId: poi.contentid, title: poi.title, point: { lat, lng } };
}

/** 원도심·영도 4개 구 POI를 병렬 조회 (세션 캐시 경유) */
export function fetchAllOldTownPois(
  fetchImpl: FetchLike = fetch,
): Promise<Array<{ region: (typeof OLD_TOWN_REGIONS)[number]; pois: AreaPoi[] }>> {
  return Promise.all(
    OLD_TOWN_REGIONS.map(async (region) => ({
      region,
      pois: await fetchAreaPoisCached(region.code, fetchImpl),
    })),
  );
}
