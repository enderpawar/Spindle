import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDetailCache, fetchPoiDetailCached, firstSentence, stripHtml } from "./details";
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

beforeEach(() => clearDetailCache());

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
    const detail = await fetchPoiDetailCached("100", makeFetch({ common, intro }) as typeof fetch);

    expect(detail.title).toBe("감천문화마을");
    expect(detail.imageUrl).toBe("https://img/1.jpg");
    expect(detail.usetime).toBe("09:00~18:00");
    expect(detail.restdate).toBe("매주 월요일");
    expect(detail.overview).toContain("산비탈 마을이에요.");
    expect(detail.overview).not.toContain("<p>"); // HTML 제거 확인
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
});
