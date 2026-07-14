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

/** detailIntro2는 contentTypeId별로 이용시간·쉬는날 필드명이 다르다 */
type DetailIntroItem = Record<string, string | undefined>;

interface DetailImageItem {
  originimgurl?: string;
  smallimageurl?: string;
  imgname?: string;
}

type DetailCommonBody = ListBody<DetailCommonItem>;
type DetailImageBody = ListBody<DetailImageItem>;

const INTRO_FIELDS: Record<string, { usetime: string; restdate: string }> = {
  "12": { usetime: "usetime", restdate: "restdate" }, // 관광지
  "14": { usetime: "usetimeculture", restdate: "restdateculture" }, // 문화시설
  "28": { usetime: "usetimeleports", restdate: "restdateleports" }, // 레포츠
  "38": { usetime: "opentime", restdate: "restdateshopping" }, // 쇼핑
  "39": { usetime: "opentimefood", restdate: "restdatefood" }, // 음식점
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
  if (introResult.status === "fulfilled") {
    const intro = extractItems(introResult.value)[0];
    const fields = INTRO_FIELDS[common.contenttypeid];
    if (intro && fields) {
      usetime = intro[fields.usetime] || undefined;
      restdate = intro[fields.restdate] || undefined;
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
  const pending = fetchDetail(contentId, fetchImpl).catch((err: unknown) => {
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
