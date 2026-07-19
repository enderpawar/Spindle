import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDetailCache,
  clearImageCache,
  fetchPoiCardDetailCached,
  fetchPoiDetailCached,
  fetchPoiGalleryImagesCached,
  fetchPoiImageCached,
  firstSentence,
  normalizeIntroValue,
  poiImageProxyUrl,
  selectPrimaryVisitFacts,
  stripHtml,
  visitFactsFromIntro,
} from "./details";
import { TourApiError } from "./tourapi";

/** TourAPI 목록 응답 봉투 — item이 null이면 빈 결과("") */
function envelope(item: unknown): unknown {
  return {
    response: {
      header: { resultCode: "0000", resultMsg: "OK" },
      body: {
        items: item == null ? "" : { item },
        numOfRows: "1",
        pageNo: "1",
        totalCount: item == null ? "0" : "1",
      },
    },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

interface Routes {
  common: unknown;
  intro?: unknown;
  image?: unknown;
  introReject?: boolean;
  imageReject?: boolean;
}

/** 엔드포인트별로 응답을 분기하는 fetch 목 */
function makeFetch(routes: Routes) {
  return vi.fn((url: string | URL) => {
    const u = String(url);
    if (u.includes("/api/detailCommon2")) {
      return Promise.resolve(jsonResponse(envelope(routes.common)));
    }
    if (u.includes("/api/detailIntro2")) {
      return routes.introReject
        ? Promise.reject(new Error("intro down"))
        : Promise.resolve(jsonResponse(envelope(routes.intro ?? null)));
    }
    if (u.includes("/api/detailImage2")) {
      return routes.imageReject
        ? Promise.reject(new Error("image down"))
        : Promise.resolve(jsonResponse(envelope(routes.image ?? null)));
    }
    return Promise.reject(new Error(`unexpected url ${u}`));
  });
}

beforeEach(() => {
  clearDetailCache();
  clearImageCache();
});

describe("stripHtml", () => {
  it("태그·br·엔티티를 제거하고 공백을 정리한다", () => {
    expect(stripHtml("<b>가</b>나<br>다")).toBe("가나 다");
    expect(stripHtml("A&amp;B&nbsp;C")).toBe("A&B C");
    expect(stripHtml("  여러   공백  ")).toBe("여러 공백");
  });
});

describe("firstSentence — 한 줄 소개", () => {
  it("첫 문장만 취한다", () => {
    expect(firstSentence("첫 문장이에요. 둘째 문장.")).toBe("첫 문장이에요.");
  });
  it("마침표가 없으면 전체를 사용한다", () => {
    expect(firstSentence("마침표 없는 소개")).toBe("마침표 없는 소개");
  });
  it("너무 길면 말줄임한다", () => {
    const long = "가".repeat(100);
    const out = firstSentence(long);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("detailIntro2 방문정보 정규화", () => {
  it("HTML을 제거하고 br 줄바꿈은 유지한다", () => {
    expect(normalizeIntroValue("09:00~18:00<br>입장 마감 17:30")).toBe("09:00~18:00\n입장 마감 17:30");
    expect(normalizeIntroValue("<b>무료</b>&nbsp;관람")).toBe("무료 관람");
    expect(normalizeIntroValue(" - ")).toBeUndefined();
  });

  it("관광지는 이용시간·휴무·체험·주차를 우선한다", () => {
    const facts = visitFactsFromIntro("12", {
      contentid: "1",
      usetime: "09:00~18:00",
      restdate: "매주 월요일",
      expguide: "마을 해설 투어",
      parking: "인근 공영주차장 이용",
      infocenter: "051-000-0000",
    });
    expect(facts.slice(0, 4).map(({ key, label }) => ({ key, label }))).toEqual([
      { key: "hours", label: "이용시간" },
      { key: "closed", label: "휴무일" },
      { key: "experience", label: "체험 안내" },
      { key: "parking", label: "주차" },
    ]);
  });

  it.each([
    ["14", { usetimeculture: "10:00~18:00", restdateculture: "월요일", usefee: "무료", spendtime: "약 1시간" }, ["hours", "closed", "fee", "duration"]],
    ["28", { usetimeleports: "09:00~17:00", restdateleports: "화요일", usefeeleports: "10,000원", reservation: "전화 예약" }, ["hours", "closed", "fee", "reservation"]],
    ["38", { opentime: "08:00~20:00", restdateshopping: "일요일", saleitem: "수산물", fairday: "매월 5일" }, ["hours", "closed", "items", "marketDay"]],
    ["39", { opentimefood: "11:00~21:00", restdatefood: "연중무휴", firstmenu: "밀면", reservationfood: "예약 가능" }, ["hours", "closed", "menu", "reservation"]],
  ])("contentType %s의 상위 방문정보 순서를 고정한다", (contentTypeId, intro, expectedKeys) => {
    expect(visitFactsFromIntro(contentTypeId, intro).map((fact) => fact.key)).toEqual(expectedKeys);
  });

  it("빈 필드를 제외해 후순위 정보가 앞으로 온다", () => {
    const facts = visitFactsFromIntro("14", {
      usetimeculture: "",
      restdateculture: " ",
      parkingculture: "주차 가능",
      infocenterculture: "051-000-0000",
    });
    expect(facts).toEqual([
      { key: "parking", label: "주차", value: "주차 가능" },
      { key: "contact", label: "문의", value: "051-000-0000" },
    ]);
  });

  it("지원하지 않는 contentType은 빈 목록을 반환한다", () => {
    expect(visitFactsFromIntro("32", { roomcount: "10" })).toEqual([]);
  });

  it("결과 본문에는 우선순위가 높은 정보 최대 4개만 선택한다", () => {
    const facts = visitFactsFromIntro("12", {
      usetime: "09:00~18:00",
      restdate: "월요일",
      expguide: "해설",
      parking: "가능",
      expagerange: "전 연령",
      infocenter: "051-000-0000",
    });
    expect(selectPrimaryVisitFacts(facts).map((fact) => fact.key)).toEqual([
      "hours",
      "closed",
      "experience",
      "parking",
    ]);
  });
});

describe("fetchPoiDetailCached — 상세 3종 결합", () => {
  it("common+intro+image를 합쳐 PoiDetail로 반환한다", async () => {
    const common = {
      contentid: "100",
      contenttypeid: "12",
      title: "감천문화마을",
      overview: "<p>산비탈 마을이에요.</p> 색색의 집이 모여 있어요.",
      firstimage: "https://img/1.jpg",
      addr1: "부산 사하구",
    };
    const intro = { usetime: "09:00~18:00", restdate: "매주 월요일" };
    const fetchMock = makeFetch({ common, intro });
    const detail = await fetchPoiDetailCached("100", fetchMock as typeof fetch);

    expect(detail.title).toBe("감천문화마을");
    expect(detail.imageUrl).toBe("https://img/1.jpg");
    expect(detail.usetime).toBe("09:00~18:00");
    expect(detail.restdate).toBe("매주 월요일");
    expect(detail.visitFacts).toEqual([
      { key: "hours", label: "이용시간", value: "09:00~18:00" },
      { key: "closed", label: "휴무일", value: "매주 월요일" },
    ]);
    expect(detail.visitFactsStatus).toBe("ready");
    expect(detail.overview).toContain("산비탈 마을이에요.");
    expect(detail.overview).not.toContain("<p>"); // HTML 제거 확인
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("detailImage2"))).toHaveLength(0);
  });

  it("firstimage가 없으면 detailImage2에서 이미지를 보충한다", async () => {
    const common = { contentid: "101", contenttypeid: "12", title: "X", firstimage: "" };
    const image = [{ originimgurl: "https://img/o.jpg", smallimageurl: "https://img/s.jpg" }];
    const detail = await fetchPoiDetailCached("101", makeFetch({ common, image }) as typeof fetch);
    expect(detail.imageUrl).toBe("https://img/o.jpg");
  });

  it("TourAPI 이미지 URL이 http로 오면 https로 정규화한다", async () => {
    const common = {
      contentid: "101-http",
      contenttypeid: "12",
      title: "HTTP 이미지",
      firstimage: "http://tong.visitkorea.or.kr/cms/resource/a.jpg",
    };
    const detail = await fetchPoiDetailCached(
      "101-http",
      makeFetch({ common }) as typeof fetch,
    );
    expect(detail.imageUrl).toBe("https://tong.visitkorea.or.kr/cms/resource/a.jpg");
  });

  it("intro·image가 실패해도 카드는 반환된다 (부분 실패 허용)", async () => {
    const common = {
      contentid: "102",
      contenttypeid: "12",
      title: "Y",
      overview: "소개 문장.",
      firstimage: "https://img/y.jpg",
    };
    const detail = await fetchPoiDetailCached(
      "102",
      makeFetch({ common, introReject: true, imageReject: true }) as typeof fetch,
    );
    expect(detail.overview).toBe("소개 문장.");
    expect(detail.imageUrl).toBe("https://img/y.jpg");
    expect(detail.usetime).toBeUndefined();
    expect(detail.restdate).toBeUndefined();
    expect(detail.visitFacts).toEqual([]);
    expect(detail.visitFactsStatus).toBe("error");
  });

  it("소개정보 부분 실패는 캐시하지 않아 다음 호출에서 재시도한다", async () => {
    const common = { contentid: "102-retry", contenttypeid: "12", title: "재시도" };
    const fetchMock = makeFetch({ common, introReject: true });
    await fetchPoiDetailCached("102-retry", fetchMock as typeof fetch);
    await fetchPoiDetailCached("102-retry", fetchMock as typeof fetch);
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("detailIntro2"))).toHaveLength(2);
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("detailCommon2"))).toHaveLength(1);
  });

  it("detailCommon2가 비면 TourApiError를 던진다", async () => {
    await expect(
      fetchPoiDetailCached("103", makeFetch({ common: null }) as typeof fetch),
    ).rejects.toThrowError(TourApiError);
  });

  it("같은 contentId를 두 번 조회해도 common 호출은 한 번만 나간다", async () => {
    const common = { contentid: "104", contenttypeid: "12", title: "Z", firstimage: "https://i" };
    const fetchMock = makeFetch({ common });
    await fetchPoiDetailCached("104", fetchMock as typeof fetch);
    await fetchPoiDetailCached("104", fetchMock as typeof fetch);
    const commonCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("detailCommon2"),
    );
    expect(commonCalls).toHaveLength(1);
  });

  it("썸네일 조회 뒤 상세 조회를 해도 detailCommon2를 재호출하지 않는다", async () => {
    const common = { contentid: "105", contenttypeid: "12", title: "P", firstimage: "https://i.jpg" };
    const fetchMock = makeFetch({ common });
    await fetchPoiImageCached("105", fetchMock as typeof fetch);
    await fetchPoiDetailCached("105", fetchMock as typeof fetch);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("detailCommon2"))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("detailImage2"))).toHaveLength(0);
  });
});

describe("fetchPoiCardDetailCached — 결과 카드용 빠른 상세", () => {
  it("카드 표시에는 detailIntro2를 기다리지 않는다", async () => {
    const common = {
      contentid: "300",
      contenttypeid: "12",
      title: "빠른 카드",
      overview: "<p>바로 보여줄 소개.</p>",
      firstimage: "https://img/card.jpg",
    };
    const fetchMock = makeFetch({ common, introReject: true });
    const detail = await fetchPoiCardDetailCached("300", fetchMock as typeof fetch);
    expect(detail.title).toBe("빠른 카드");
    expect(detail.overview).toBe("바로 보여줄 소개.");
    expect(detail.imageUrl).toBe("https://img/card.jpg");
    expect(detail.visitFactsStatus).toBe("not-requested");
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("detailIntro2"))).toHaveLength(0);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("detailImage2"))).toHaveLength(0);
  });

  it("편의시설 사진뿐인 POI는 대표 이미지를 쓰지 않는다", async () => {
    const common = {
      contentid: "3083767",
      contenttypeid: "14",
      title: "부산근현대역사관 본관",
      firstimage: "http://tong.visitkorea.or.kr/cms/resource/38/3428638_image2_1.jpg",
    };
    const fetchMock = makeFetch({ common });
    const detail = await fetchPoiCardDetailCached("3083767", fetchMock as typeof fetch);
    expect(detail.imageUrl).toBeUndefined();
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("detailImage2"))).toHaveLength(0);
  });

  it("detailImage2 후보의 이미지명이 편의시설이면 건너뛴다", async () => {
    const common = { contentid: "301", contenttypeid: "12", title: "이미지 보충", firstimage: "" };
    const image = [
      { imgname: "가족화장실", originimgurl: "https://img/restroom.jpg" },
      { imgname: "외관", originimgurl: "https://img/front.jpg" },
    ];
    const detail = await fetchPoiCardDetailCached("301", makeFetch({ common, image }) as typeof fetch);
    expect(detail.imageUrl).toBe("https://img/front.jpg");
  });
});

describe("fetchPoiGalleryImagesCached — 관광지 이미지 슬라이드", () => {
  it("firstimage와 detailImage2 이미지를 중복 없이 모은다", async () => {
    const common = { contentid: "400", contenttypeid: "12", title: "갤러리", firstimage: "http://img/cover.jpg" };
    const image = [
      { imgname: "외관", originimgurl: "http://img/cover.jpg", smallimageurl: "http://img/cover-small.jpg" },
      { imgname: "전시실", originimgurl: "http://img/inside.jpg" },
    ];
    const images = await fetchPoiGalleryImagesCached("400", makeFetch({ common, image }) as typeof fetch);
    expect(images).toEqual(["https://img/cover.jpg", "https://img/inside.jpg"]);
  });

  it("이미지명이 편의시설이면 슬라이드 후보에서 제외한다", async () => {
    const common = { contentid: "401", contenttypeid: "12", title: "필터", firstimage: "" };
    const image = [
      { imgname: "가족화장실", originimgurl: "https://img/restroom.jpg" },
      { imgname: "외관", originimgurl: "https://img/front.jpg" },
    ];
    const images = await fetchPoiGalleryImagesCached("401", makeFetch({ common, image }) as typeof fetch);
    expect(images).toEqual(["https://img/front.jpg"]);
  });

  it("편의시설 사진뿐인 POI는 빈 갤러리를 반환한다", async () => {
    const common = {
      contentid: "3083767",
      contenttypeid: "14",
      title: "부산근현대역사관 본관",
      firstimage: "http://tong.visitkorea.or.kr/cms/resource/38/3428638_image2_1.jpg",
    };
    const fetchMock = makeFetch({ common });
    const images = await fetchPoiGalleryImagesCached("3083767", fetchMock as typeof fetch);
    expect(images).toEqual([]);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("detailImage2"))).toHaveLength(0);
  });
});

describe("fetchPoiImageCached — 썸네일 경량 이미지", () => {
  it("detailCommon2 firstimage를 https로 정규화해 반환한다", async () => {
    const common = {
      contentid: "200",
      contenttypeid: "12",
      title: "T",
      firstimage: "http://tong.visitkorea.or.kr/cms/a.jpg",
    };
    const url = await fetchPoiImageCached("200", makeFetch({ common }) as typeof fetch);
    expect(url).toBe("https://tong.visitkorea.or.kr/cms/a.jpg");
  });

  it("firstimage가 비면 detailImage2 첫 장으로 보충한다", async () => {
    const common = { contentid: "201", contenttypeid: "12", title: "U", firstimage: "" };
    const image = [{ originimgurl: "https://img/o.jpg", smallimageurl: "https://img/s.jpg" }];
    const url = await fetchPoiImageCached("201", makeFetch({ common, image }) as typeof fetch);
    expect(url).toBe("https://img/o.jpg");
  });

  it("이미지가 전혀 없으면 null을 반환한다 (폴백은 호출부에서)", async () => {
    const common = { contentid: "202", contenttypeid: "12", title: "V", firstimage: "" };
    const url = await fetchPoiImageCached("202", makeFetch({ common, image: null }) as typeof fetch);
    expect(url).toBeNull();
  });

  it("firstimage가 있으면 detailImage2는 호출하지 않는다 (호출 1회)", async () => {
    const common = { contentid: "203", contenttypeid: "12", title: "W", firstimage: "https://i.jpg" };
    const fetchMock = makeFetch({ common });
    await fetchPoiImageCached("203", fetchMock as typeof fetch);
    await fetchPoiImageCached("203", fetchMock as typeof fetch); // 캐시 히트
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("detailCommon2"))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("detailImage2"))).toHaveLength(0);
  });

  it("poiImageProxyUrl은 contentId로 프록시 이미지 경로를 만든다", () => {
    expect(poiImageProxyUrl("126122")).toBe("/api/img?contentId=126122");
  });
});
