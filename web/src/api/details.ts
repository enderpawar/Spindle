/**
 * 결과 카드용 상세 조회 — detailCommon2 / detailIntro2 / detailImage2 (결과 시점 호출).
 * 프록시 경유·세션 메모리 캐시만 사용 (tourapi 스킬 규약, 절대 원칙 3).
 * 이용시간·쉬는날은 자유 텍스트 → 파싱은 engine/operation.ts, 실패 시 원문 노출.
 */
import { API_BASE, TourApiError, callTourApi, extractItems, type ListBody } from "./tourapi";

type FetchLike = typeof fetch;

interface DetailCommonItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  overview?: string;
  firstimage?: string;
  addr1?: string;
}

/** detailIntro2는 contentTypeId별로 필드명이 다르다 */
type DetailIntroItem = Record<string, string | undefined>;

interface DetailImageItem {
  originimgurl?: string;
  smallimageurl?: string;
  imgname?: string;
}

type DetailCommonBody = ListBody<DetailCommonItem>;
type DetailImageBody = ListBody<DetailImageItem>;

export type PoiVisitFactKey =
  | "hours"
  | "closed"
  | "experience"
  | "age"
  | "parking"
  | "contact"
  | "season"
  | "capacity"
  | "fee"
  | "duration"
  | "reservation"
  | "items"
  | "marketDay"
  | "restroom"
  | "menu"
  | "menuList"
  | "packing"
  | "kids";

export interface PoiVisitFact {
  key: PoiVisitFactKey;
  label: string;
  value: string;
}

interface IntroFieldDefinition {
  key: PoiVisitFactKey;
  label: string;
  field: string;
}

/**
 * 관광객의 방문 결정에 유용한 순서. 앞의 네 항목은 결과 본문에, 전체 항목은 상세 시트에 쓴다.
 * 값이 없는 항목은 건너뛰므로 후순위 정보가 자연스럽게 자리를 채운다.
 */
const INTRO_FIELDS: Record<string, readonly IntroFieldDefinition[]> = {
  "12": [
    { key: "hours", label: "이용시간", field: "usetime" },
    { key: "closed", label: "휴무일", field: "restdate" },
    { key: "experience", label: "체험 안내", field: "expguide" },
    { key: "parking", label: "주차", field: "parking" },
    { key: "age", label: "체험 연령", field: "expagerange" },
    { key: "season", label: "이용 시기", field: "useseason" },
    { key: "contact", label: "문의", field: "infocenter" },
    { key: "capacity", label: "수용 인원", field: "accomcount" },
  ],
  "14": [
    { key: "hours", label: "관람시간", field: "usetimeculture" },
    { key: "closed", label: "휴무일", field: "restdateculture" },
    { key: "fee", label: "이용요금", field: "usefee" },
    { key: "duration", label: "관람 소요시간", field: "spendtime" },
    { key: "parking", label: "주차", field: "parkingculture" },
    { key: "contact", label: "문의", field: "infocenterculture" },
  ],
  "28": [
    { key: "hours", label: "이용시간", field: "usetimeleports" },
    { key: "closed", label: "휴무일", field: "restdateleports" },
    { key: "fee", label: "이용요금", field: "usefeeleports" },
    { key: "reservation", label: "예약 안내", field: "reservation" },
    { key: "parking", label: "주차", field: "parkingleports" },
    { key: "age", label: "체험 연령", field: "expagerangeleports" },
    { key: "season", label: "운영 기간", field: "openperiod" },
    { key: "contact", label: "문의", field: "infocenterleports" },
  ],
  "38": [
    { key: "hours", label: "영업시간", field: "opentime" },
    { key: "closed", label: "휴무일", field: "restdateshopping" },
    { key: "items", label: "주요 품목", field: "saleitem" },
    { key: "marketDay", label: "장날", field: "fairday" },
    { key: "parking", label: "주차", field: "parkingshopping" },
    { key: "restroom", label: "화장실", field: "restroom" },
    { key: "contact", label: "문의", field: "infocentershopping" },
  ],
  "39": [
    { key: "hours", label: "영업시간", field: "opentimefood" },
    { key: "closed", label: "휴무일", field: "restdatefood" },
    { key: "menu", label: "대표 메뉴", field: "firstmenu" },
    { key: "reservation", label: "예약 안내", field: "reservationfood" },
    { key: "menuList", label: "취급 메뉴", field: "treatmenu" },
    { key: "parking", label: "주차", field: "parkingfood" },
    { key: "packing", label: "포장", field: "packing" },
    { key: "kids", label: "어린이 시설", field: "kidsfacility" },
    { key: "contact", label: "문의", field: "infocenterfood" },
  ],
};

export interface PoiDetail {
  contentId: string;
  contentTypeId: string;
  title: string;
  /** HTML 태그 제거된 소개 원문 */
  overview?: string;
  imageUrl?: string;
  addr1?: string;
  /** 자유 텍스트 원문 (파싱은 표시 시점에) */
  usetime?: string;
  restdate?: string;
  /** contentType별 TourAPI 소개정보를 관광객용 라벨·값으로 정규화한 목록 */
  visitFacts: PoiVisitFact[];
  /** 카드 경량 조회는 not-requested, 상세 소개 성공/실패는 ready/error */
  visitFactsStatus: "not-requested" | "ready" | "error";
}

/** TourAPI 텍스트 필드의 HTML 태그·엔티티 정리 */
export function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** TourAPI 소개정보의 줄바꿈은 유지하고 나머지 HTML·엔티티만 정리한다. */
export function normalizeIntroValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  return normalized && normalized !== "-" ? normalized : undefined;
}

export function visitFactsFromIntro(
  contentTypeId: string,
  intro: DetailIntroItem | undefined,
): PoiVisitFact[] {
  if (!intro) return [];
  return (INTRO_FIELDS[contentTypeId] ?? []).flatMap((definition) => {
    const value = normalizeIntroValue(intro[definition.field]);
    return value ? [{ key: definition.key, label: definition.label, value }] : [];
  });
}

export function selectPrimaryVisitFacts(
  facts: readonly PoiVisitFact[],
  limit = 4,
): PoiVisitFact[] {
  return facts.slice(0, Math.max(0, limit));
}

/** 소개 첫 문장 (ui.md S4: "한 줄 소개") — 과도하게 길면 말줄임 */
export function firstSentence(overview: string, maxLength = 80): string {
  const text = stripHtml(overview);
  const match = /^.*?[.!?](?=\s|$)/.exec(text);
  const sentence = (match ? match[0] : text).trim();
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1)}…` : sentence;
}

function normalizeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}

const commonCache = new Map<string, Promise<DetailCommonItem>>();

const FACILITY_ONLY_IMAGE_CONTENT_IDS = new Set([
  // TourAPI images for this content are facility photos only (family restroom, parking, elevator).
  "3083767",
]);

const NON_REPRESENTATIVE_IMAGE_NAME_RE =
  /화장실|주차장|주차면|엘리베이터|에스칼레이터|에스컬레이터|수유실|장애인/i;

async function fetchCommon(contentId: string, fetchImpl: FetchLike): Promise<DetailCommonItem> {
  const commonBody = await callTourApi<DetailCommonBody>(
    "detailCommon2",
    { contentId },
    fetchImpl,
  );
  const common = extractItems(commonBody)[0];
  if (!common) throw new TourApiError("상세 정보가 없어요");
  return common;
}

function fetchCommonCached(contentId: string, fetchImpl: FetchLike): Promise<DetailCommonItem> {
  const cached = commonCache.get(contentId);
  if (cached) return cached;
  const pending = fetchCommon(contentId, fetchImpl).catch((err: unknown) => {
    commonCache.delete(contentId);
    throw err;
  });
  commonCache.set(contentId, pending);
  return pending;
}

function representativeImageFromItems(items: DetailImageItem[]): string | null {
  for (const item of items) {
    if (NON_REPRESENTATIVE_IMAGE_NAME_RE.test(item.originimgurl ?? "")) continue;
    if (NON_REPRESENTATIVE_IMAGE_NAME_RE.test(item.imgname ?? "")) continue;
    const url = normalizeImageUrl(item.originimgurl) ?? normalizeImageUrl(item.smallimageurl);
    if (url) return url;
  }
  return null;
}

function addUniqueImage(target: string[], url: string | undefined): void {
  if (!url || target.includes(url)) return;
  target.push(url);
}

function galleryImagesFromItems(items: DetailImageItem[], seedImage?: string): string[] {
  const urls: string[] = [];
  addUniqueImage(urls, seedImage);
  for (const item of items) {
    if (NON_REPRESENTATIVE_IMAGE_NAME_RE.test(item.originimgurl ?? "")) continue;
    if (NON_REPRESENTATIVE_IMAGE_NAME_RE.test(item.imgname ?? "")) continue;
    addUniqueImage(urls, normalizeImageUrl(item.originimgurl) ?? normalizeImageUrl(item.smallimageurl));
  }
  return urls;
}

async function fetchRepresentativeImage(
  contentId: string,
  common: DetailCommonItem,
  fetchImpl: FetchLike,
): Promise<string | null> {
  if (FACILITY_ONLY_IMAGE_CONTENT_IDS.has(contentId)) return null;

  const fromCommon = normalizeImageUrl(common.firstimage);
  if (fromCommon) return fromCommon;

  const imgBody = await callTourApi<DetailImageBody>(
    "detailImage2",
    { contentId },
    fetchImpl,
  );
  return representativeImageFromItems(extractItems(imgBody));
}

const representativeImageCache = new Map<string, Promise<string | null>>();
const galleryImageCache = new Map<string, Promise<string[]>>();

function fetchRepresentativeImageCached(
  contentId: string,
  common: DetailCommonItem,
  fetchImpl: FetchLike,
): Promise<string | null> {
  const cached = representativeImageCache.get(contentId);
  if (cached) return cached;
  const pending = fetchRepresentativeImage(contentId, common, fetchImpl).catch((err: unknown) => {
    representativeImageCache.delete(contentId);
    throw err;
  });
  representativeImageCache.set(contentId, pending);
  return pending;
}

async function fetchGalleryImages(
  contentId: string,
  common: DetailCommonItem,
  fetchImpl: FetchLike,
): Promise<string[]> {
  if (FACILITY_ONLY_IMAGE_CONTENT_IDS.has(contentId)) return [];

  const seedImage = normalizeImageUrl(common.firstimage);
  let body: DetailImageBody;
  try {
    body = await callTourApi<DetailImageBody>(
      "detailImage2",
      { contentId },
      fetchImpl,
    );
  } catch {
    return seedImage ? [seedImage] : [];
  }
  return galleryImagesFromItems(extractItems(body), seedImage);
}

function fetchGalleryImagesCached(
  contentId: string,
  common: DetailCommonItem,
  fetchImpl: FetchLike,
): Promise<string[]> {
  const cached = galleryImageCache.get(contentId);
  if (cached) return cached;
  const pending = fetchGalleryImages(contentId, common, fetchImpl).catch((err: unknown) => {
    galleryImageCache.delete(contentId);
    throw err;
  });
  galleryImageCache.set(contentId, pending);
  return pending;
}

function detailFromCommon(common: DetailCommonItem, imageUrl: string | null): PoiDetail {
  return {
    contentId: common.contentid,
    contentTypeId: common.contenttypeid,
    title: common.title,
    overview: common.overview ? stripHtml(common.overview) : undefined,
    imageUrl: imageUrl ?? undefined,
    addr1: common.addr1 || undefined,
    visitFacts: [],
    visitFactsStatus: "not-requested",
  };
}

async function fetchCardDetail(contentId: string, fetchImpl: FetchLike): Promise<PoiDetail> {
  const common = await fetchCommonCached(contentId, fetchImpl);
  const imageUrl = await fetchRepresentativeImageCached(contentId, common, fetchImpl).catch(() => null);
  return detailFromCommon(common, imageUrl);
}

async function fetchDetail(contentId: string, fetchImpl: FetchLike): Promise<PoiDetail> {
  const common = await fetchCommonCached(contentId, fetchImpl);

  // 소개(intro)·이미지는 실패해도 카드 자체는 뜨도록 부분 실패 허용
  const [introResult, imageResult] = await Promise.allSettled([
    callTourApi<ListBody<DetailIntroItem>>(
      "detailIntro2",
      { contentId, contentTypeId: common.contenttypeid },
      fetchImpl,
    ),
    fetchRepresentativeImageCached(contentId, common, fetchImpl),
  ]);

  let usetime: string | undefined;
  let restdate: string | undefined;
  let visitFacts: PoiVisitFact[] = [];
  if (introResult.status === "fulfilled") {
    const intro = extractItems(introResult.value)[0];
    visitFacts = visitFactsFromIntro(common.contenttypeid, intro);
    if (intro) {
      usetime = visitFacts.find((fact) => fact.key === "hours")?.value;
      restdate = visitFacts.find((fact) => fact.key === "closed")?.value;
    }
  }

  const base = detailFromCommon(
    common,
    imageResult.status === "fulfilled" ? imageResult.value : null,
  );

  return {
    ...base,
    usetime,
    restdate,
    visitFacts,
    visitFactsStatus: introResult.status === "fulfilled" ? "ready" : "error",
  };
}

// 세션 범위 메모리 캐시 — 영속화 금지 (절대 원칙 3). 실패 Promise는 제거해 재시도 가능.
const detailCache = new Map<string, Promise<PoiDetail>>();
const cardDetailCache = new Map<string, Promise<PoiDetail>>();

export function fetchPoiDetailCached(
  contentId: string,
  fetchImpl: FetchLike = fetch,
): Promise<PoiDetail> {
  const cached = detailCache.get(contentId);
  if (cached) return cached;
  const pending = fetchDetail(contentId, fetchImpl)
    .then((detail) => {
      // 소개정보 부분 실패는 카드 표시를 막지 않되, 다음 재시도가 실제 호출하도록 캐시하지 않는다.
      if (detail.visitFactsStatus === "error") detailCache.delete(contentId);
      return detail;
    })
    .catch((err: unknown) => {
      detailCache.delete(contentId);
      throw err;
    });
  detailCache.set(contentId, pending);
  return pending;
}

export function fetchPoiCardDetailCached(
  contentId: string,
  fetchImpl: FetchLike = fetch,
): Promise<PoiDetail> {
  const cached = cardDetailCache.get(contentId);
  if (cached) return cached;
  const pending = fetchCardDetail(contentId, fetchImpl).catch((err: unknown) => {
    cardDetailCache.delete(contentId);
    throw err;
  });
  cardDetailCache.set(contentId, pending);
  return pending;
}

export async function fetchPoiGalleryImagesCached(
  contentId: string,
  fetchImpl: FetchLike = fetch,
): Promise<string[]> {
  const common = await fetchCommonCached(contentId, fetchImpl);
  return fetchGalleryImagesCached(contentId, common, fetchImpl).catch(() => []);
}

/** 테스트용 */
export function clearDetailCache(): void {
  detailCache.clear();
  cardDetailCache.clear();
  commonCache.clear();
  representativeImageCache.clear();
  galleryImageCache.clear();
}

// ── 목록·덱 썸네일용 경량 이미지 조회 ──
// 결과 카드는 상세 3종(fetchPoiDetailCached)이 필요하지만, 리스트 썸네일은 대표 이미지만
// 있으면 되므로 detailCommon2 한 번만 호출한다. 상세 캐시와 분리된 세션 메모리 캐시.

async function fetchPoiImage(contentId: string, fetchImpl: FetchLike): Promise<string | null> {
  const common = await fetchCommonCached(contentId, fetchImpl);
  return fetchRepresentativeImageCached(contentId, common, fetchImpl);
}

/** 썸네일용 대표 이미지 URL (없으면 null). 세션 메모리 캐시만 사용 (절대 원칙 3). */
export function fetchPoiImageCached(
  contentId: string,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  return fetchPoiImage(contentId, fetchImpl).catch(() => null);
}

/** 테스트용 */
export function clearImageCache(): void {
  representativeImageCache.clear();
  galleryImageCache.clear();
  commonCache.clear();
}

/**
 * 공유 카드 canvas용 same-origin 이미지 URL.
 * TourAPI 이미지 CDN엔 CORS 헤더가 없어 <img crossOrigin>·canvas.toBlob이 오염으로 실패한다.
 * 프록시(/api/img)로 중계해 same-origin으로 만든다. 표시 전용 <img>는 이 프록시가 필요 없다.
 */
export function poiImageProxyUrl(contentId: string): string {
  return `${API_BASE}/img?contentId=${encodeURIComponent(contentId)}`;
}
