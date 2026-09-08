/**
 * 기능설명서의 mermaid 도식을 PNG로 렌더링한다.
 *
 * 제출 양식이 마크다운을 렌더링하지 못하면 도식이 코드 덩어리로 남는다
 * (기능설명서 "제출 전 확인 항목"). 그래서 원본 `.mmd`는 따로 보관하고
 * 문서 본문에는 이미지를 넣는다 — 도식을 고칠 때는 `.mmd`를 고치고 이 스크립트를 다시 돌린다.
 *
 * 사용법: node render-mermaid.mjs
 * 산출: docs/screenshots/diagram-*.png (+ 원본 diagram-*.mmd)
 */
import { chromium } from 'playwright'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const OUT_DIR = join(REPO, 'docs', 'screenshots')

/** 도식 정의 — 파일명과 원본. 순서는 기능설명서 등장 순서다. */
const DIAGRAMS = [
  {
    name: 'diagram-zones',
    title: '존-교량 모델 (기능설명서 4.2)',
    src: `flowchart LR
    Z5["Z5 서구·송도"] ---|충무동~송도 해안도로| Z1["Z1 남포·광복"]
    Z1 ---|도시철도 1호선| Z2["Z2 부산역·초량"]
    Z1 ---|영도대교| Z3["Z3 영도 서부"]
    Z2 ---|부산대교 또는 도시철도+도보| Z3
    Z3 ---|태종대 방면 버스| Z4["Z4 영도 동부"]`,
  },
  {
    name: 'diagram-architecture',
    title: '좌표 무전송 아키텍처 (기능설명서 6장)',
    src: `flowchart LR
    S[GPS·나침반 센서] -->|단말 내부 입력| C[PWA 클라이언트]
    C --> L[단말 내 계산: 존 판정·방향 매칭·거리·필터·코스]
    C -->|지역코드·contentId·날짜만| P[Cloudflare Workers 프록시]
    P -->|환경변수 인증키 주입·요청 중계| T[TourAPI]
    T -->|실시간 관광 데이터| P
    P -->|no-store 응답| C
    C -. 사용자 좌표·방위각 전송 없음 .-> P`,
  },
]

/** 한글이 깨지지 않도록 Windows 기본 한글 폰트를 명시한다. */
const FONT = "'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"

function page(src) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 24px; background: #fff; font-family: ${FONT}; }
    #d { display: inline-block; }
    #d svg { max-width: none !important; height: auto !important; }
  </style></head><body><div id="d" class="mermaid">${src}</div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      fontFamily: ${JSON.stringify(FONT)},
      themeVariables: {
        primaryColor: '#eaf1ff', primaryBorderColor: '#3b6fd4', primaryTextColor: '#0f2540',
        lineColor: '#5b7ba6', secondaryColor: '#f3f6fb', tertiaryColor: '#fff',
      },
    })
    await mermaid.run({ nodes: [document.getElementById('d')] })
    // mermaid는 SVG를 기본 폭(대개 600px 안팎)으로 내보낸다. 문서에 넣기엔 작아서
    // viewBox 기준으로 키운다 — 벡터라 확대해도 화질이 상하지 않는다.
    const svg = document.querySelector('#d svg')
    const vb = svg.viewBox.baseVal
    const target = 1500
    const k = vb.width ? target / vb.width : 1
    svg.style.maxWidth = 'none'
    svg.setAttribute('width', String(vb.width * k))
    svg.setAttribute('height', String(vb.height * k))
    window.__done = true
  </script></body></html>`
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ deviceScaleFactor: 2, colorScheme: 'light' })
  const p = await ctx.newPage()

  for (const d of DIAGRAMS) {
    await writeFile(join(OUT_DIR, `${d.name}.mmd`), d.src + '\n')
    await p.setContent(page(d.src), { waitUntil: 'networkidle' })
    await p.waitForFunction(() => window.__done === true, null, { timeout: 60_000 })
    const box = p.locator('#d')
    await box.screenshot({ path: join(OUT_DIR, `${d.name}.png`), scale: 'device' })
    const buf = await readFile(join(OUT_DIR, `${d.name}.png`))
    console.log(`  ✓ ${d.name}.png  ${Math.round(buf.length / 1024)}KB  — ${d.title}`)
  }

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
