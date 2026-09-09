import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index";
import { UPSTREAM_ATTEMPT_TIMEOUT_MS, fetchUpstream } from "../src/upstream";

const env: Env = {
  TOURAPI_SERVICE_KEY: "test-key",
  ALLOWED_ORIGIN: "https://spindle.example",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TourAPI upstream retry", () => {
  it("1회차 타임아웃 뒤 2회차가 성공하면 200을 반환한다", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request(
        "https://proxy.example/api/areaBasedList2?areaCode=6&sigunguCode=15&pageNo=1&numOfRows=100",
      ),
      env,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("3회 모두 실패하면 502 upstream unreachable을 반환한다", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchMock = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal?.aborted).toBe(true);
      return Promise.reject(init?.signal?.reason);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request(
        "https://proxy.example/api/areaBasedList2?areaCode=6&sigunguCode=15&pageNo=1&numOfRows=100",
      ),
      env,
    );

    expect(timeoutSpy).toHaveBeenCalledTimes(3);
    expect(timeoutSpy).toHaveBeenCalledWith(UPSTREAM_ATTEMPT_TIMEOUT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "upstream unreachable" });
  });

  it("업스트림 4xx는 재시도하지 않는다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://proxy.example/api/detailCommon2?contentId=126122"),
      env,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(400);
  });

  it("정상 JSON이면 resultCode와 무관하게 재시도하지 않는다", async () => {
    const body = JSON.stringify({ response: { header: { resultCode: "99" } } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://proxy.example/api/detailCommon2?contentId=126122"),
      env,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ response: { header: { resultCode: "99" } } });
  });

  it("전체 9초 예산을 넘기면 남은 시도를 시작하지 않는다", async () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(5_500)
      .mockReturnValueOnce(10_000);
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchUpstream("https://example.com", {}, 10_000)).rejects.toThrow(
      "upstream unreachable",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(nowSpy).toHaveBeenCalledTimes(3);
  });

  it("시도당 타임아웃은 3초다", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchUpstream("https://example.com");

    expect(timeoutSpy).toHaveBeenCalledWith(3_000);
  });
});
