import { describe, expect, it } from "vitest";
import worker, { type Env } from "../src/index";

/**
 * Capacitor 네이티브 셸은 웹 자산을 로컬 번들로 로드하므로 오리진이 Pages 도메인이 아니다
 * (Android `https://localhost`, iOS `capacitor://localhost`).
 * 이 오리진들이 막히면 앱에서 TourAPI 호출이 전부 CORS로 차단된다 — 실제로 겪은 회귀라 고정한다.
 */

const PAGES_ORIGIN = "https://spindle-6vp.pages.dev";

const env: Env = {
  TOURAPI_SERVICE_KEY: "test-key",
  ALLOWED_ORIGIN: PAGES_ORIGIN,
};

function preflight(origin?: string): Promise<Response> {
  const headers = origin === undefined ? undefined : { Origin: origin };
  return Promise.resolve(
    worker.fetch(new Request("https://proxy.example/api/areaBasedList2", { method: "OPTIONS", headers }), env),
  ).then((r) => r);
}

async function allowOriginFor(origin?: string): Promise<string | null> {
  const res = await preflight(origin);
  return res.headers.get("Access-Control-Allow-Origin");
}

describe("CORS 허용 오리진", () => {
  it("Pages 프로덕션 오리진을 허용한다", async () => {
    expect(await allowOriginFor(PAGES_ORIGIN)).toBe(PAGES_ORIGIN);
  });

  it("Android 앱 셸 오리진(https://localhost)을 허용한다", async () => {
    expect(await allowOriginFor("https://localhost")).toBe("https://localhost");
  });

  it("iOS 앱 셸 오리진(capacitor://localhost)을 허용한다", async () => {
    expect(await allowOriginFor("capacitor://localhost")).toBe("capacitor://localhost");
  });

  it("허용 목록에 없는 오리진은 반향하지 않는다", async () => {
    expect(await allowOriginFor("https://evil.example")).toBe(PAGES_ORIGIN);
  });

  it("Origin 헤더가 없으면 설정된 첫 오리진을 쓴다", async () => {
    expect(await allowOriginFor()).toBe(PAGES_ORIGIN);
  });

  it("ALLOWED_ORIGIN 미설정이면 와일드카드를 쓴다 (로컬 개발)", async () => {
    const res = await worker.fetch(
      new Request("https://proxy.example/api/areaBasedList2", {
        method: "OPTIONS",
        headers: { Origin: "https://localhost" },
      }),
      { TOURAPI_SERVICE_KEY: "test-key" },
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("오리진별로 캐시가 갈리도록 Vary: Origin을 붙인다", async () => {
    const res = await preflight("https://localhost");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("쉼표로 구분한 다중 ALLOWED_ORIGIN을 모두 허용한다", async () => {
    const multi: Env = {
      TOURAPI_SERVICE_KEY: "test-key",
      ALLOWED_ORIGIN: `${PAGES_ORIGIN}, https://spindle.example`,
    };
    const res = await worker.fetch(
      new Request("https://proxy.example/api/areaBasedList2", {
        method: "OPTIONS",
        headers: { Origin: "https://spindle.example" },
      }),
      multi,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://spindle.example");
  });
});
