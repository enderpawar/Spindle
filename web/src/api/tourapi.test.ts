import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TourApiError,
  clearSessionCache,
  fetchAreaPois,
  fetchAreaPoisCached,
  toNumber,
} from "./tourapi";
import type { AreaPoi } from "./tourapi";

function poi(id: number): AreaPoi {
  return {
    contentid: String(id),
    contenttypeid: "12",
    title: `POI ${id}`,
    addr1: "부산광역시",
    firstimage: "",
    sigungucode: "15",
    mapx: "129.0306", // guard-allow: 테스트 픽스처의 TourAPI 응답 좌표 필드 (사용자 좌표 아님)
    mapy: "35.0985", // guard-allow: 테스트 픽스처의 TourAPI 응답 좌표 필드 (사용자 좌표 아님)
  };
}

function okPage(items: AreaPoi[], pageNo: number, totalCount: number) {
  return {
    response: {
      header: { resultCode: "0000", resultMsg: "OK" },
      body: {
        items: items.length > 0 ? { item: items } : "",
        numOfRows: "100",
        pageNo: String(pageNo),
        totalCount: String(totalCount),
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

beforeEach(() => clearSessionCache());

describe("fetchAreaPois — 페이징", () => {
  it("totalCount만큼 페이지를 이어 호출해 전체를 수집한다", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => poi(i + 1));
    const page2 = Array.from({ length: 50 }, (_, i) => poi(i + 101));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(okPage(page1, 1, 150)))
      .mockResolvedValueOnce(jsonResponse(okPage(page2, 2, 150)));

    const pois = await fetchAreaPois("15", fetchMock as typeof fetch);

    expect(pois).toHaveLength(150);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("/api/areaBasedList2");
    expect(firstUrl).toContain("areaCode=6");
    expect(firstUrl).toContain("sigunguCode=15");
    const secondUrl = String(fetchMock.mock.calls[1][0]);
    expect(secondUrl).toContain("pageNo=2");
  });

  it("빈 결과(items === \"\")면 빈 배열을 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(okPage([], 1, 0)));
    await expect(fetchAreaPois("15", fetchMock as typeof fetch)).resolves.toEqual([]);
  });

  it("resultCode !== 0000 이면 resultMsg를 담아 던진다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        response: { header: { resultCode: "22", resultMsg: "LIMITED NUMBER OF SERVICE REQUESTS EXCEEDS ERROR" } },
      }),
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(fetchAreaPois("15", fetchMock as typeof fetch)).rejects.toThrowError(TourApiError);
    consoleSpy.mockRestore();
  });
});

describe("fetchAreaPoisCached — 세션 메모리 캐시", () => {
  it("같은 구를 두 번 조회해도 fetch는 한 번만 나간다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(okPage([poi(1)], 1, 1)));
    await fetchAreaPoisCached("15", fetchMock as typeof fetch);
    await fetchAreaPoisCached("15", fetchMock as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("실패한 조회는 캐시에 남지 않아 재시도된다", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(jsonResponse(okPage([poi(1)], 1, 1)));
    await expect(fetchAreaPoisCached("15", fetchMock as typeof fetch)).rejects.toThrow();
    await expect(fetchAreaPoisCached("15", fetchMock as typeof fetch)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("toNumber — 문자열 응답 필드 변환", () => {
  it("숫자 문자열을 숫자로, 비정상 값은 undefined로", () => {
    expect(toNumber("150")).toBe(150);
    expect(toNumber("35.1")).toBeCloseTo(35.1);
    expect(toNumber("")).toBeUndefined();
    expect(toNumber(undefined)).toBeUndefined();
    expect(toNumber("abc")).toBeUndefined();
  });
});
