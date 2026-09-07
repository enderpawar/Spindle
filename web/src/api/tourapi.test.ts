import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TourApiError,
  callTourApi,
  clearSessionCache,
  fetchAreaPois,
  fetchAreaPoisCached,
  resetRateLimitState,
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

beforeEach(() => {
  clearSessionCache();
  resetRateLimitState();
});

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

describe("callTourApi — 실패 원인 분류", () => {
  afterEach(() => vi.unstubAllGlobals());

  const params = { areaCode: "6", sigunguCode: "15" };

  it("일반 네트워크 실패는 network", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(callTourApi("areaBasedList2", params, fetchMock as typeof fetch)).rejects.toMatchObject({
      name: "TourApiError",
      kind: "network",
    });
  });

  it("타임아웃(AbortSignal.timeout)은 timeout", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    await expect(callTourApi("areaBasedList2", params, fetchMock as typeof fetch)).rejects.toMatchObject({
      kind: "timeout",
    });
  });

  it("단말이 오프라인이면 offline이 우선한다", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(callTourApi("areaBasedList2", params, fetchMock as typeof fetch)).rejects.toMatchObject({
      kind: "offline",
    });
  });

  it("navigator.onLine이 true여도 단정하지 않는다", async () => {
    // onLine은 "랜선이 꽂혀 있다" 수준의 신호라 true를 신뢰하지 않는다.
    vi.stubGlobal("navigator", { onLine: true });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(callTourApi("areaBasedList2", params, fetchMock as typeof fetch)).rejects.toMatchObject({
      kind: "network",
    });
  });

  it("비정상 상태 코드는 http + status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad gateway", { status: 502 }));
    await expect(callTourApi("areaBasedList2", params, fetchMock as typeof fetch)).rejects.toMatchObject({
      kind: "http",
      status: 502,
    });
  });

  it("TourAPI 오류 응답은 api + resultCode", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const body = { response: { header: { resultCode: "22", resultMsg: "LIMITED_NUMBER_OF_SERVICE_REQUESTS" } } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
    await expect(callTourApi("areaBasedList2", params, fetchMock as typeof fetch)).rejects.toMatchObject({
      kind: "api",
      resultCode: "22",
    });
  });

  it("옵션 없이 만든 오류는 api로 취급한다", () => {
    // details.ts의 "상세 정보가 없어요"처럼 응답은 왔지만 내용이 빈 경우.
    expect(new TourApiError("상세 정보가 없어요").kind).toBe("api");
  });
});

describe("429 호출 한도 처리", () => {
  const params = { areaCode: "6", sigunguCode: "15" };

  // Retry-After: 0 으로 실제 대기 없이 재시도 경로만 확인한다.
  function tooManyRequests(retryAfter = "0"): Response {
    return new Response("", { status: 429, headers: { "Retry-After": retryAfter } });
  }

  it("일시적인 429는 재시도해서 넘긴다 (초당 호출 제한)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tooManyRequests())
      .mockResolvedValueOnce(jsonResponse(okPage([poi(1)], 1, 1)));

    const body = await callTourApi("areaBasedList2", params, fetchMock as typeof fetch);

    expect(body).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("재시도로도 안 풀리면 rateLimited로 던지고 더 두드리지 않는다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(tooManyRequests());

    await expect(
      callTourApi("detailIntro2", { contentId: "1", contentTypeId: "12" }, fetchMock as typeof fetch),
    ).rejects.toMatchObject({ kind: "rateLimited", status: 429 });

    // 최초 1회 + 백오프 재시도 2회
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // 쿨다운이 걸린 뒤에는 네트워크를 아예 타지 않는다 — 남은 호출 예산을 아낀다.
    fetchMock.mockClear();
    await expect(
      callTourApi("detailIntro2", { contentId: "2", contentTypeId: "12" }, fetchMock as typeof fetch),
    ).rejects.toMatchObject({ kind: "rateLimited" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("쿨다운은 엔드포인트별이다 — 트래픽이 오퍼레이션 단위로 집계되기 때문", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const limited = vi.fn().mockResolvedValue(tooManyRequests());
    await expect(
      callTourApi("detailIntro2", { contentId: "1", contentTypeId: "12" }, limited as typeof fetch),
    ).rejects.toMatchObject({ kind: "rateLimited" });

    // detailIntro2가 막혔어도 areaBasedList2는 그대로 동작해야 한다.
    const healthy = vi.fn().mockResolvedValue(jsonResponse(okPage([poi(1)], 1, 1)));
    await expect(
      callTourApi("areaBasedList2", params, healthy as typeof fetch),
    ).resolves.toBeDefined();
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
