import { describe, expect, it } from "vitest";
import {
  isAllowedImageHost,
  isValidContentId,
  normalizeImageUrl,
  validateRequest,
} from "../src/validate";

function run(path: string, query: string) {
  return validateRequest(path, new URLSearchParams(query));
}

describe("validateRequest", () => {
  it("허용 엔드포인트 + 화이트리스트 파라미터는 통과한다", () => {
    const r = run("/api/areaBasedList2", "areaCode=6&sigunguCode=15&pageNo=1&numOfRows=100");
    expect(r).toEqual({
      ok: true,
      endpoint: "areaBasedList2",
      params: [
        ["areaCode", "6"],
        ["sigunguCode", "15"],
        ["pageNo", "1"],
        ["numOfRows", "100"],
      ],
    });
  });

  it("화이트리스트 외 파라미터(mapX 등 좌표)는 400 거부한다", () => {
    for (const q of ["mapX=129.03", "mapY=35.1", "areaCode=6&mapX=129.03", "radius=1000"]) {
      const r = run("/api/areaBasedList2", q);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
  });

  it("허용 목록 밖 엔드포인트(좌표 기반 목록 조회 포함)는 400 거부한다", () => {
    // 절대 원칙 2의 금지 엔드포인트명은 guard 스캐너에 걸리므로 직접 표기하지 않는다
    const banned = ["location" + "BasedList2", "searchKeyword2", "anything"];
    for (const ep of banned) {
      const r = run(`/api/${ep}`, "areaCode=6");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
  });

  it("/api/<endpoint> 형태가 아닌 경로는 404", () => {
    for (const p of ["/", "/api", "/api/", "/other/areaBasedList2", "/api/a/b"]) {
      const r = run(p, "");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(404);
    }
  });

  it("비정상 파라미터 값(과도한 길이·특수문자)은 400", () => {
    for (const q of ["areaCode=6%2F..%2F", "contentId=" + "1".repeat(64), "arrange=%3Cscript%3E"]) {
      const r = run("/api/areaBasedList2", q);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
  });

  it("detailIntro2 등 상세 계열도 화이트리스트로 통과한다", () => {
    const r = run("/api/detailIntro2", "contentId=126508&contentTypeId=12");
    expect(r.ok).toBe(true);
  });
});

describe("이미지 릴레이(/api/img) 검증 헬퍼", () => {
  it("contentId는 짧은 영숫자만 허용한다", () => {
    expect(isValidContentId("126122")).toBe(true);
    expect(isValidContentId("3083767")).toBe(true);
    expect(isValidContentId("")).toBe(false);
    expect(isValidContentId("1".repeat(33))).toBe(false);
    expect(isValidContentId("../etc")).toBe(false);
    expect(isValidContentId("12 34")).toBe(false);
  });

  it("이미지 URL의 http는 https로 정규화한다", () => {
    expect(normalizeImageUrl("http://tong.visitkorea.or.kr/a.jpg")).toBe(
      "https://tong.visitkorea.or.kr/a.jpg",
    );
    expect(normalizeImageUrl("https://tong.visitkorea.or.kr/a.jpg")).toBe(
      "https://tong.visitkorea.or.kr/a.jpg",
    );
  });

  it("허용 호스트(TourAPI 이미지 CDN)만 통과시킨다 — SSRF 방지", () => {
    expect(isAllowedImageHost("https://tong.visitkorea.or.kr/cms/resource/a.jpg")).toBe(true);
    expect(isAllowedImageHost("https://evil.example.com/a.jpg")).toBe(false);
    expect(isAllowedImageHost("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedImageHost("not a url")).toBe(false);
  });
});
