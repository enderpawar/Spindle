/**
 * AGENTS.md 절대 원칙 3 (자동 검증): TourAPI 응답은 어떤 영속 저장소에도 남지 않는다.
 *
 * R2에서 "실패 → 다시 시도" 경로가 생겼으므로, 재시도가 응답을 어딘가에 쌓아 두는
 * 형태로 자라지 않도록 고정한다. 허용되는 것은 세션 메모리 캐시뿐이며,
 * 실패한 Promise는 캐시에서 빠져 재시도가 실제로 다시 호출해야 한다.
 *
 * node 환경에는 localStorage·indexedDB·caches가 없으므로 감시용 스텁을 심어 둔다 —
 * 코드가 이들을 건드리기 시작하면 곧바로 실패한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDetailCache, fetchPoiDetailCached } from "./details";
import { clearSessionCache, fetchAreaPoisCached } from "./tourapi";

const storage = {
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  getItem: vi.fn(() => null),
  key: vi.fn(() => null),
  length: 0,
};

const cacheStore = { put: vi.fn(), add: vi.fn(), addAll: vi.fn(), delete: vi.fn() };
const caches = { open: vi.fn(async () => cacheStore), keys: vi.fn(async () => []) };
const indexedDB = { open: vi.fn(), deleteDatabase: vi.fn() };

function envelope(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ response: { header: { resultCode: "0000" }, body } }),
  } as unknown as Response;
}

function bodyFor(url: string): unknown {
  if (url.includes("detailCommon2")) {
    return { items: { item: { contentid: "126508", contenttypeid: "12", title: "감천문화마을" } } };
  }
  if (url.includes("areaBasedList2")) return { items: "", totalCount: "0" };
  return { items: "" }; // detailIntro2 / detailImage2
}

beforeEach(() => {
  clearSessionCache();
  clearDetailCache();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("caches", caches);
  vi.stubGlobal("indexedDB", indexedDB);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function expectNothingPersisted(): void {
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
  expect(caches.open).not.toHaveBeenCalled();
  expect(cacheStore.put).not.toHaveBeenCalled();
  expect(indexedDB.open).not.toHaveBeenCalled();
}

describe("재시도 경로 — 영속 저장 금지 (절대 원칙 3)", () => {
  it("구별 목록: 실패한 뒤 다시 시도해도 아무것도 저장하지 않는다", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(envelope({ items: "", totalCount: "0" }));

    await expect(fetchAreaPoisCached("15", fetchMock as typeof fetch)).rejects.toThrow();
    await expect(fetchAreaPoisCached("15", fetchMock as typeof fetch)).resolves.toEqual([]);

    // 실패가 캐시에 남지 않아 재시도가 실제로 다시 호출됐다.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expectNothingPersisted();
  });

  it("상세: 실패한 뒤 다시 시도해도 아무것도 저장하지 않는다", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      return Promise.resolve(envelope(bodyFor(url)));
    });
    const failing = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchPoiDetailCached("126508", failing as typeof fetch)).rejects.toThrow();
    await expect(fetchPoiDetailCached("126508", fetchMock as typeof fetch)).resolves.toMatchObject({
      title: "감천문화마을",
    });

    expect(fetchMock).toHaveBeenCalled();
    expectNothingPersisted();
  });

  it("재시도가 성공해도 응답을 저장소에 옮기지 않는다", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(envelope({ items: "", totalCount: "0" })));
    await fetchAreaPoisCached("14", fetchMock as typeof fetch);
    await fetchAreaPoisCached("14", fetchMock as typeof fetch); // 세션 메모리 캐시 히트

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectNothingPersisted();
  });
});
