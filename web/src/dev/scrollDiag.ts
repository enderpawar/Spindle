/**
 * 임시 진단 계측기 v2 — 콜드 스타트 직후 스크롤이 안 먹는 원인을 실기기에서 잡는 도구.
 * 원인 확정 후 삭제한다 (main.tsx의 mountScrollDiag 호출도 함께).
 *
 * 켜는 법: Safari에서 `<앱 URL>?scrolldebug=1`을 한 번 연다(플래그가 localStorage에
 * 저장된다) → 홈 화면 앱을 콜드 스타트하면 상단에 패널이 뜬다.
 * 끄는 법: `?scrolldebug=0`.
 *
 * v1은 레이아웃(프레임 높이·safe-area)을 쟀고, 그 결과 프레임은 정상이고 스크롤러가
 * 839px 넘치는데도 손가락이 안 먹는다는 게 드러났다. 그래서 v2는 터치를 좇는다:
 *
 *   - 드래그 중 scrollTop이 변하는가 → 변하면 "렌더가 얼어붙은 것"(View Transition
 *     스냅샷이 살아있는 DOM을 덮고 있는 상태), 안 변하면 "터치가 안 닿는 것".
 *   - 터치 지점의 최상단 요소가 무엇인가 → 투명 오버레이가 가로채는지 바로 보인다.
 *   - touchmove가 아예 안 오는가 → touch-action·preventDefault 문제.
 *   - documentElement[data-view-transition]이 몇 ms나 걸려 있는가 → 전환이 안 끝나는지.
 */

const FLAG_KEY = 'spindle.scrolldebug'
const MAX_ROWS = 200

/** `?scrolldebug=1`을 localStorage에 굳혀, 홈 화면 앱(standalone) 실행에서도 켜지게 한다. */
function enabled(): boolean {
  const param = new URLSearchParams(window.location.search).get('scrolldebug')
  if (param === '1') localStorage.setItem(FLAG_KEY, '1')
  if (param === '0') localStorage.removeItem(FLAG_KEY)
  return localStorage.getItem(FLAG_KEY) === '1'
}

/** 화면마다 스크롤 컨테이너가 달라, 실제로 세로 스크롤을 맡은 가장 큰 요소를 찾는다. */
function findScroller(): HTMLElement | null {
  const root = document.getElementById('root')
  if (!root) return null
  let best: HTMLElement | null = null
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue
    if (el.clientHeight < 120) continue
    if (!best || el.clientHeight > best.clientHeight) best = el
  }
  return best
}

/** 하단 내비의 현재 탭 — 어느 화면에서 드래그했는지 로그에 남기려고 읽는다. */
function currentTab(): string {
  const active = document.querySelector('.bottom-nav [aria-current="page"]')
  return active?.textContent?.trim() || '?'
}

function describe(el: Element | null): string {
  if (!el) return '·'
  const cls = el.className && typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : ''
  return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase()
}

/** 터치 지점에 실제로 쌓여 있는 요소들 — 투명 오버레이가 가로채는지 여기서 드러난다. */
function stackAt(x: number, y: number): string {
  const els = document.elementsFromPoint(x, y).slice(0, 3)
  return els.map(describe).join(' < ')
}

export function mountScrollDiag(): void {
  if (typeof window === 'undefined' || !enabled()) return

  const start = performance.now()
  const rows: string[] = []
  const now = () => Math.round(performance.now() - start)

  const panel = document.createElement('pre')
  panel.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:99999',
    'margin:0',
    'padding:6px 8px',
    'max-height:38vh',
    'overflow:auto',
    'background:rgba(8,16,32,.93)',
    'color:#9ff',
    'font:9px/1.3 ui-monospace,Menlo,monospace',
    'white-space:pre-wrap',
    'pointer-events:none', // 패널이 터치를 가로채면 진단 자체가 오염된다
  ].join(';')

  const copy = document.createElement('button')
  copy.textContent = '복사'
  copy.style.cssText =
    'position:fixed;right:6px;bottom:6px;z-index:100000;font-size:12px;padding:8px 12px;border-radius:8px'
  copy.onclick = () => {
    void navigator.clipboard?.writeText(rows.join('\n')).then(
      () => (copy.textContent = '복사됨'),
      () => (copy.textContent = '실패'),
    )
  }

  const log = (line: string) => {
    rows.push(`${String(now()).padStart(6)}ms ${line}`)
    if (rows.length > MAX_ROWS) rows.shift()
    panel.textContent = rows.slice(-14).join('\n')
  }

  // ── 터치 추적 ──────────────────────────────────────────────
  let scroller: HTMLElement | null = null
  let startTop = 0
  let moveCount = 0
  let cancelableMoves = 0
  let maxDelta = 0
  let overflow = 0
  let inside = false
  let startInfo = ''

  window.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0]
      if (!t) return
      scroller = findScroller()
      startTop = scroller?.scrollTop ?? -1
      moveCount = 0
      cancelableMoves = 0
      maxDelta = 0
      overflow = scroller ? scroller.scrollHeight - scroller.clientHeight : 0
      inside = Boolean(scroller && t.target instanceof Node && scroller.contains(t.target))
      const vt = document.documentElement.dataset.viewTransition ?? '-'
      startInfo = `[${currentTab()}] top=${stackAt(t.clientX, t.clientY)} vt=${vt} over=${overflow}`
    },
    { capture: true, passive: true },
  )

  window.addEventListener(
    'touchmove',
    () => {
      moveCount++
      if (scroller) maxDelta = Math.max(maxDelta, Math.abs(scroller.scrollTop - startTop))
    },
    { capture: true, passive: true },
  )

  // cancelable=false면 브라우저가 이미 스크롤을 가져간 것 — 터치는 정상 도달했다는 뜻
  window.addEventListener(
    'touchmove',
    (e) => {
      if (e.cancelable) cancelableMoves++
    },
    { capture: true, passive: true },
  )

  window.addEventListener(
    'touchend',
    () => {
      // 탭(움직임 없음)은 스크롤 진단과 무관 — 로그를 채우지 않는다
      if (moveCount < 3) return

      // 스크롤할 게 없는 화면(지도 등)이나 스크롤러 밖에서 시작한 드래그는 판정 대상이 아니다.
      // v2가 이걸 "스크롤 실패"로 잘못 표시해 지도 패닝이 오탐으로 잡혔다.
      if (!scroller || overflow <= 0) {
        log(`↕ ${startInfo} → 판정없음 (이 화면엔 스크롤러 없음)`)
        return
      }
      if (!inside) {
        log(`↕ ${startInfo} → 판정없음 (스크롤러 바깥에서 시작)`)
        return
      }

      const endTop = scroller.scrollTop
      if (maxDelta === 0) {
        log(`★★★ 재현 ${startInfo} move×${moveCount} cancelable×${cancelableMoves} scrollTop 0 고정`)
      } else {
        log(`↕ ${startInfo} move×${moveCount} scrollTop ${startTop}→${endTop} (Δ${maxDelta}) 정상`)
      }
    },
    { capture: true, passive: true },
  )

  // ── View Transition이 안 끝나고 걸려 있는지 ────────────────
  let vtSince = 0
  let lastVt = ''
  window.setInterval(() => {
    const vt = document.documentElement.dataset.viewTransition ?? ''
    if (vt !== lastVt) {
      if (lastVt && vtSince) log(`vt '${lastVt}' 종료 (${now() - vtSince}ms 지속)`)
      if (vt) {
        vtSince = now()
        log(`vt '${vt}' 시작`)
      }
      lastVt = vt
    } else if (vt && now() - vtSince > 1000) {
      log(`⚠ vt '${vt}' 가 ${now() - vtSince}ms째 안 끝남`)
      vtSince = now() // 1초마다 한 번만
    }
  }, 100)

  document.body.appendChild(panel)
  document.body.appendChild(copy)
  log(`시작 (screen=${window.screen.height}, standalone=${window.matchMedia('(display-mode: standalone)').matches})`)
}
