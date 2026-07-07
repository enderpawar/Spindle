/**
 * Spindle TourAPI 프록시 (Cloudflare Workers)
 * 역할은 두 가지뿐: serviceKey 환경변수 주입, 요청 중계 (tourapi 스킬 규약).
 * 요청·응답을 어디에도 저장·로깅하지 않는다 (AGENTS.md 절대 원칙 3·4).
 */
import { TOURAPI_BASE, validateRequest } from "./validate";

export interface Env {
  /** TourAPI 디코딩된 인증키 — .dev.vars(로컬) / wrangler secret(프로덕션)에만 존재 */
  TOURAPI_SERVICE_KEY: string;
  /** CORS 허용 오리진. 미설정 시 "*" (Phase 6에서 Pages 도메인으로 좁힘) */
  ALLOWED_ORIGIN?: string;
}

const UPSTREAM_TIMEOUT_MS = 10_000;

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonError(env: Env, status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env) },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method !== "GET") {
      return jsonError(env, 405, "GET only");
    }

    const url = new URL(request.url);
    const result = validateRequest(url.pathname, url.searchParams);
    if (!result.ok) return jsonError(env, result.status, result.message);

    if (!env.TOURAPI_SERVICE_KEY) {
      return jsonError(env, 500, "service key not configured");
    }

    const upstream = new URL(`${TOURAPI_BASE}/${result.endpoint}`);
    for (const [key, value] of result.params) upstream.searchParams.set(key, value);
    // 디코딩된 키를 넣으면 URLSearchParams가 인코딩을 수행한다
    upstream.searchParams.set("serviceKey", env.TOURAPI_SERVICE_KEY);
    upstream.searchParams.set("MobileOS", "ETC");
    upstream.searchParams.set("MobileApp", "Spindle");
    upstream.searchParams.set("_type", "json");

    let res: Response;
    try {
      res = await fetch(upstream.toString(), {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch {
      return jsonError(env, 502, "upstream unreachable");
    }

    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json; charset=utf-8",
        // TourAPI 응답이 브라우저 HTTP 캐시에도 남지 않게 명시 (실시간 호출 규정)
        "Cache-Control": "no-store",
        ...corsHeaders(env),
      },
    });
  },
};
