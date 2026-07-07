/**
 * TourAPI 호출 유틸 — 항상 프록시(/api) 경유, 직접 호출 금지 (tourapi 스킬 규약).
 * 응답은 세션 범위 메모리 캐시(Map)에만 보관한다 — localStorage·IndexedDB 등
 * 영속 저장소 적재 금지 (AGENTS.md 절대 원칙 3).
 */
import { BUSAN_AREA_CODE, OLD_TOWN_REGIONS } from "./regionCodes";

const API_BASE: string = import.meta.env.VITE_API_BASE ?? "/api";

/** tourapi 스킬 기본값 — 구별 POI 수를 감안해 충분히 크게 */
const NUM_OF_ROWS = 100;

type FetchLike = typeof fetch;

export class TourApiError extends Error {
  readonly resultCode?: string;
  constructor(message: string, resultCode?: string) {
    super(message);
    this.name = "TourApiError";
    this.resultCode = resultCode;
  }
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
  title: string;
  addr1: string;
  firstimage: string;
  sigungucode: string;
  mapx: string; // guard-allow: TourAPI 응답의 POI 경도 읽기 — 사용자 좌표 아님, 요청 파라미터로 쓰지 않음
  mapy: string; // guard-allow: TourAPI 응답의 POI 위도 읽기 — 단말 내 방향·거리 계산 전용
}

interface ListBody<T> {
  items: { item: T | T[] } | "";
  numOfRows: number | string;
  pageNo: number | string;
  totalCount: number | string;
}

interface TourApiEnvelope<B> {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: B;
  };
}

async function callTourApi<B>(
  endpoint: string,
  params: Record<string, string>,
  fetchImpl: FetchLike,
): Promise<B> {
  const qs = new URLSearchParams(params);
  let res: Response;
  try {
    res = await fetchImpl(`${API_BASE}/${endpoint}?${qs.toString()}`);
  } catch {
    throw new TourApiError("네트워크 요청 실패");
  }
  if (!res.ok) throw new TourApiError(`프록시 응답 오류 (HTTP ${res.status})`);

  const data = (await res.json()) as TourApiEnvelope<B>;
  const header = data.response?.header;
  const body = data.response?.body;
  if (header?.resultCode !== "0000" || body === undefined) {
    // 규약: resultCode !== "0000"이면 콘솔에 resultMsg 로깅 + 사용자 재시도 UI
    console.error("TourAPI 오류:", header?.resultCode, header?.resultMsg);
    throw new TourApiError(header?.resultMsg ?? "TourAPI 응답 형식 오류", header?.resultCode);
  }
  return body;
}

function extractItems<T>(body: ListBody<T>): T[] {
  if (body.items === "" || body.items == null) return []; // 빈 결과는 items가 "" 로 온다
  const item = body.items.item;
  return Array.isArray(item) ? item : [item];
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
    all.push(...items);
    const totalCount = toNumber(String(body.totalCount)) ?? 0;
    if (all.length >= totalCount || items.length === 0) return all;
    pageNo += 1;
  }
}

// 세션 범위 메모리 캐시 — 탭이 닫히면 사라진다. 영속화 금지 (절대 원칙 3).
const sessionCache = new Map<string, Promise<AreaPoi[]>>();

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
