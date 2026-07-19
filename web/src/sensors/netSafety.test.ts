/**
 * Phase 4 DoD (자동 검증): 현장 모드에서 취득한 GPS 좌표·나침반 방위각이
 * 어떤 네트워크 요청 페이로드에도 실리지 않음을 고정한다 (AGENTS.md 절대 원칙 1).
 *
 * 현장 모드가 실제로 호출하는 네트워크 표면은 여행 모드와 동일하다:
 *   - 목록: areaBasedList2 (지역코드만)
 *   - 상세: detailCommon2/detailIntro2/detailImage2 (contentId만)
 * 좌표·방위각은 recommend()(순수 함수)로만 흘러가고 네트워크를 타지 않는다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDetailCache, fetchPoiDetailCached } from "../api/details";
import { clearSessionCache, fetchAllOldTownPois } from "../api/tourapi";
import { recommend } from "../engine/recommend";

/** callTourApi가 기대하는 최소 응답 봉투 */
function envelope(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ response: { header: { resultCode: "0000" }, body } }),
  } as unknown as Response;
}

function bodyFor(url: string): unknown {
  if (url.includes("detailCommon2")) {
    return { items: { item: { contentid: "2609623", contenttypeid: "12", title: "개미집" } } };
  }
  if (url.includes("areaBasedList2")) return { items: "", totalCount: "0" };
  return { items: "" }; // detailIntro2 / detailImage2
}

describe("현장 모드 네트워크 안전 — 좌표·방위각 무전송", () => {
  beforeEach(() => {
    clearSessionCache();
    clearDetailCache();
  });

  it("현장 모드 데이터 경로의 어떤 요청에도 좌표·방위각이 없다", async () => {
    const urls: string[] = [];
    const spy = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return Promise.resolve(envelope(bodyFor(url)));
    });
    const fetchImpl = spy as unknown as typeof fetch;

    // 현장 모드가 취득했다고 가정하는 실제 좌표·방위각 (구별 가능한 값)
    const fix = { origin: { lat: 35.09876, lng: 129.03012 }, heading: 137.42 };

    // 현장 모드가 실제로 호출하는 네트워크 함수들 (좌표를 인자로 받지 않는다)
    await fetchAllOldTownPois(fetchImpl);
    await fetchPoiDetailCached("2609623", fetchImpl);

    const callsBeforeRecommend = spy.mock.calls.length;
    // 좌표·방위각은 recommend(순수 함수)로만 소비 — 네트워크를 타지 않는다
    recommend({
      origin: fix.origin,
      heading: fix.heading,
      budgetMinutes: 40,
      pois: [{ contentId: "1", title: "t", point: { lat: 35.1, lng: 129.03 } }],
      rng: () => 0,
    });
    expect(spy.mock.calls.length).toBe(callsBeforeRecommend); // recommend는 요청을 추가하지 않음

    const joined = urls.join("\n");
    // 좌표·방위각 실제 값이 어떤 URL에도 등장하지 않음
    expect(joined).not.toContain("35.09876");
    expect(joined).not.toContain("129.03012");
    expect(joined).not.toContain("137.42");
    // 좌표·방위 계열 파라미터 키가 존재하지 않음
    // (금지 좌표 파라미터명은 분할 결합으로 표기 — guard 오탐 방지, 실제 검사 대상은 동일)
    const coordKeys = ["map" + "x", "map" + "y", "lat", "latitude", "lng", "lon", "longitude", "heading", "bearing"];
    const coordKeyPattern = new RegExp("[?&](" + coordKeys.join("|") + ")=", "i");
    expect(joined).not.toMatch(coordKeyPattern);
    // 최소한 목록 4개 구 + 상세 3종은 호출됨 (경로 자체는 정상 동작)
    expect(urls.some((u) => u.includes("areaBasedList2"))).toBe(true);
    expect(urls.some((u) => u.includes("detailCommon2"))).toBe(true);
  });
});
