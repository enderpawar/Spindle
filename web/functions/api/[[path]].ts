/**
 * Cloudflare Pages 프리뷰 전용 same-origin 릴레이.
 *
 * 프로덕션 Worker는 제출 URL 하나만 CORS로 허용한다. 프리뷰는 브라우저가
 * `/api`를 같은 출처로 호출하게 하고, 이 함수가 기존 Worker로 스트리밍한다.
 * 인증키 주입과 파라미터 화이트리스트 검증은 기존 Worker가 그대로 담당하며,
 * 여기서는 요청이나 응답을 저장하거나 기록하지 않는다.
 */

const UPSTREAM = 'https://spindle-proxy.enderpawar.workers.dev'
const PRODUCTION_ORIGIN = 'https://spindle-6vp.pages.dev'

interface PreviewRelayContext {
  request: Request
}

const errorResponse = (status: number, message: string) => new Response(
  JSON.stringify({ error: message }),
  {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  },
)

export const onRequest = async ({ request }: PreviewRelayContext): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Allow': 'GET, OPTIONS',
        'Cache-Control': 'no-store',
      },
    })
  }
  if (request.method !== 'GET') return errorResponse(405, 'GET only')

  const incoming = new URL(request.url)
  if (!incoming.pathname.startsWith('/api/')) return errorResponse(404, 'not found')

  const upstreamUrl = new URL(`${incoming.pathname}${incoming.search}`, UPSTREAM)
  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        'Accept': request.headers.get('Accept') ?? '*/*',
        'Origin': PRODUCTION_ORIGIN,
      },
    })
  } catch {
    return errorResponse(502, 'preview relay unavailable')
  }

  const headers = new Headers(upstream.headers)
  headers.set('Cache-Control', 'no-store')
  headers.delete('Access-Control-Allow-Origin')
  headers.delete('Access-Control-Allow-Credentials')

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
}
