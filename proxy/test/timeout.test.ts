import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index";

const env: Env = {
  TOURAPI_SERVICE_KEY: "test-key",
  ALLOWED_ORIGIN: "https://spindle.example",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TourAPI upstream timeout", () => {
  it("8초 제한 신호가 초과되면 502 upstream unreachable을 반환한다", async () => {
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

    expect(timeoutSpy).toHaveBeenCalledWith(8_000);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "upstream unreachable" });
  });
});
