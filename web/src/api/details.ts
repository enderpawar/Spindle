/**
 * 결과 카드용 상세 조회 — detailCommon2 / detailIntro2 / detailImage2 (결과 시점 호출).
 * 프록시 경유·세션 메모리 캐시만 사용 (tourapi 스킬 규약, 절대 원칙 3).
 * 이용시간·쉬는날은 자유 텍스트 → 파싱은 engine/operation.ts, 실패 시 원문 노출.
 */
import { TourApiError, callTourApi, extractItems, type ListBody } from "./tourapi";

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
}

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

async function fetchDetail(contentId: string, fetchImpl: FetchLike): Promise<PoiDetail> {
  const commonBody = await callTourApi<ListBody<DetailCommonItem>>(
    "detailCommon2",
    { contentId },
    fetchImpl,
  );
  const common = extractItems(commonBody)[0];
  if (!common) throw new TourApiError("상세 정보가 없어요");

  // 소개(intro)·이미지는 실패해도 카드 자체는 뜨도록 부분 실패 허용
  const [introResult, imagesResult] = await Promise.allSettled([
    callTourApi<ListBody<DetailIntroItem>>(
      "detailIntro2",
      { contentId, contentTypeId: common.contenttypeid },
      fetchImpl,
    ),
    callTourApi<ListBody<DetailImageItem>>("detailImage2", { contentId }, fetchImpl),
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

  let imageUrl = common.firstimage || undefined;
  if (!imageUrl && imagesResult.status === "fulfilled") {
    const first = extractItems(imagesResult.value)[0];
    imageUrl = first?.originimgurl || first?.smallimageurl || undefined;
  }

  return {
    contentId: common.contentid,
    contentTypeId: common.contenttypeid,
    title: common.title,
    overview: common.overview ? stripHtml(common.overview) : undefined,
    imageUrl,
    addr1: common.addr1 || undefined,
    usetime,
    restdate,
  };
}

// 세션 범위 메모리 캐시 — 영속화 금지 (절대 원칙 3). 실패 Promise는 제거해 재시도 가능.
const detailCache = new Map<string, Promise<PoiDetail>>();

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

/** 테스트용 */
export function clearDetailCache(): void {
  detailCache.clear();
}
