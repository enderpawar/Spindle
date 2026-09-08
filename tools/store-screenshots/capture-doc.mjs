/**
 * 기능설명서(공모전 제출) 부록용 화면 캡처.
 *
 * `capture-web.mjs`(스토어 자산용)와 의도적으로 분리했다. 그쪽은 하단 탭 5개 화면만 찍고
 * 상단 136px를 상태바 자리로 비워 1080x2400에 맞추는데, 그 빈 띠와 고정 파일명은
 * `app-store-screenshots.json` 슬라이드와 `ios-status-bar.mjs`가 의존한다. 문서용은
 * 빈 띠가 필요 없고, 탭으로 못 가는 화면(결과 카드·공유 카드·코스)까지 찍어야 한다.
 *
 * 사용법:
 *   node capture-doc.mjs [baseUrl]
 *   기본 baseUrl은 프로덕션(https://spindle-6vp.pages.dev) — dev 서버·프록시 불필요.
 *
 * 산출: docs/screenshots/a01..a11-*.png (폭 720px)
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdir, writeFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// 기존 캡처와 같은 곳에 모은다. README·데이터포털 등록 문서가 이 디렉터리를 참조하므로
// 문서용 이미지를 따로 두면 같은 화면이 저장소에 두 벌 남는다.
const OUT_DIR = join(HERE, '..', '..', 'docs', 'screenshots')
const BASE_URL = process.argv[2] ?? 'https://spindle-6vp.pages.dev'

/** 문서에 싣는 폭. 원본은 360x755@3x = 1080x2265라 그대로 두면 저장소가 무거워진다. */
const DOC_WIDTH = 720

/**
 * 도장 화면용 예시 방문 기록 — 4개 구가 고르게 진행 중으로 보이되 완주는 아닌 상태.
 * id는 web/src/mock/pois.ts 기준. 부록 캡션에 "예시 방문 기록"임을 명시한다.
 */
const VISITED_SEED = [
  'busan-tower',        // 중구
  'bupyeong-market',    // 중구
  'choryang-market',    // 동구
  'songdo-beach',       // 서구
  'huinnyeoul-tunnel',  // 영도구
  'kangkangee',         // 영도구
]

const failures = []
const captured = []

/** 헤드리스는 env(safe-area-inset-bottom)가 0이라 하단 탭 라벨이 잘린다 (capture-web.mjs와 동일). */
const SAFE_AREA_CSS = '.bottom-nav { padding-bottom: 34px !important; }'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 하단 탭 이동 — BottomNav.tsx:53 의 aria-label="주요 메뉴" 안 버튼들. */
async function goTab(page, label) {
  const nav = page.getByRole('navigation', { name: '주요 메뉴' })
  await nav.getByRole('button', { name: label, exact: true }).click()
  await sleep(1200)
}

/** 화면 상단의 뒤로 버튼. 화면마다 aria-label="뒤로"로 통일돼 있다. */
async function goBack(page) {
  await page.getByRole('button', { name: '뒤로' }).first().click()
  await sleep(900)
}

/**
 * 캡처 한 장. `check`가 주어지면 만족할 때까지 기다렸다가 찍고, 실패하면 기록만 남기고 진행한다.
 * 체인 중간이 깨져도 나머지 컷은 건지는 편이 재실행 비용이 싸다.
 */
async function shot(page, name, { check, settle = 1500 } = {}) {
  try {
    if (check) await check()
    await sleep(settle)
    const raw = await page.screenshot({ type: 'png' })
    const out = await sharp(raw).resize({ width: DOC_WIDTH }).png({ compressionLevel: 9 }).toBuffer()
    await writeFile(join(OUT_DIR, `${name}.png`), out)
    const meta = await sharp(out).metadata()
    captured.push({ name, w: meta.width, h: meta.height, kb: Math.round(out.length / 1024) })
    console.log(`  ✓ ${name}  ${meta.width}x${meta.height}  ${Math.round(out.length / 1024)}KB`)
  } catch (err) {
    failures.push({ name, reason: err.message.split('\n')[0] })
    console.log(`  ✗ ${name}  ${err.message.split('\n')[0]}`)
  }
}

/**
 * 원판을 돌린다. SpinScreen은 "스핀 실행을 원판 직접 조작으로 일원화"했고(SpinScreen.tsx:215)
 * 원판은 CompassRose.tsx:280-282의 role=button이다. 같은 컴포넌트가 키보드 조작도 받으므로
 * (CompassRose.tsx:266-270 → spinFromKeyboard) Enter를 먼저 쓰고, 안 먹으면 드래그로 넘어간다.
 * 드래그는 속도가 곧 회전 에너지라 중간 좌표를 여러 번 찍어 던지듯 움직여야 한다.
 */
async function spinWheel(page, attempt = 1) {
  const wheel = page.getByRole('button', { name: '나침반 원판을 돌려 방향 정하기' })
  await wheel.waitFor({ state: 'visible', timeout: 30_000 })

  // 두 방법을 한 회차에 같이 쓰면 스핀이 두 번 돌아 리빌이 꼬인다. 회차마다 하나만 쓴다.
  if (attempt >= 2) {
    await wheel.press('Enter')
    return
  }

  const box = await wheel.boundingBox()
  if (!box) throw new Error('원판 boundingBox를 얻지 못했다')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const r = Math.min(box.width, box.height) * 0.34

  await page.mouse.move(cx, cy - r)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    const a = (-Math.PI / 2) + (i * Math.PI) / 9
    await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  await page.mouse.up()
}

/** Reveal 화면(RevealScreen.tsx:19)을 열어 결과 카드로 넘어간다. */
async function openReveal(page) {
  const open = page.getByRole('button', { name: '바로 열어보기' })
  await open.waitFor({ state: 'visible', timeout: 45_000 })
  await open.click()
  await sleep(1500)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  console.log(`대상: ${BASE_URL}`)
  console.log(`출력: ${OUT_DIR}\n`)

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 360, height: 755 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })

  // 온보딩 스킵 + 도장 예시 기록. App.tsx:46 / lib/visited.ts:10 의 키를 그대로 쓴다.
  await context.addInitScript(
    ([visited]) => {
      localStorage.setItem('spindle.onboarded', '1')
      localStorage.setItem('spindle.visited.v1', JSON.stringify(visited))
    },
    [VISITED_SEED],
  )

  const page = await context.newPage()
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.getByRole('navigation', { name: '주요 메뉴' }).waitFor({ state: 'visible', timeout: 60_000 })
  await page.addStyleTag({ content: SAFE_AREA_CSS })
  await page.waitForLoadState('networkidle').catch(() => {})
  await sleep(2500)

  console.log('[홈 계열]')
  await shot(page, 'a01-home')

  // A-3 여행 모드 출발점 — HomeScreen.tsx:142-149 의 .home-origin 버튼이 DepartureScreen을 연다.
  await page.locator('button.home-origin').click().catch(() => {})
  await shot(page, 'a03-travel-mode', {
    check: () => page.getByText('어디서 출발하세요?').waitFor({ state: 'visible', timeout: 15_000 }),
  })
  await goBack(page).catch(() => {})

  // A-8 테마 덱 — 홈 "테마로 떠나기" 섹션에서 한 테마를 연다.
  await page.getByRole('button', { name: /바다/ }).first().click().catch(() => {})
  await shot(page, 'a09-theme-deck', {
    check: () => page.getByText('이 테마에 들어 있는 장소').waitFor({ state: 'visible', timeout: 15_000 }),
    settle: 2500,
  })
  await goBack(page).catch(() => {})

  console.log('[스핀 → 결과 → 공유 → 코스]')
  await goTab(page, '스핀')
  await shot(page, 'a02-spin', {
    check: () => page.getByRole('button', { name: '나침반 원판을 돌려 방향 정하기' }).waitFor({ state: 'visible', timeout: 30_000 }),
    settle: 2000,
  })

  // 스핀은 결과가 매번 다르다. 원판 조작이 먹지 않는 경우만 재시도한다.
  let spun = false
  for (let attempt = 1; attempt <= 3 && !spun; attempt++) {
    try {
      await spinWheel(page, attempt)
      await openReveal(page)
      spun = true
    } catch (err) {
      console.log(`  · 스핀 ${attempt}회차 실패 — ${err.message.split('\n')[0]}`)
      await sleep(1500)
    }
  }
  if (!spun) failures.push({ name: '스핀 체인', reason: '원판 조작 후 Reveal에 도달하지 못했다' })

  if (spun) {
    // A-4 결과 카드 — 방문 정보(detailIntro2)가 실제로 렌더돼야 데이터 활용 20점 근거가 된다.
    await shot(page, 'a04-result', {
      check: async () => {
        await page.getByRole('heading', { name: '방문 정보' }).waitFor({ state: 'visible', timeout: 40_000 })
        const failed = await page.getByText('방문 정보를 불러오지 못했어요').isVisible().catch(() => false)
        if (failed) throw new Error('방문 정보 조회 실패 상태로 렌더됨')
      },
      settle: 3000,
    })

    // A-5 방문 정보 — 같은 결과 카드를 스크롤한 컷. detailIntro2의 이용시간·휴무·요금·주차가
    // 실제로 보이는 유일한 장면이라, 데이터 활용 20점 근거는 A-4가 아니라 여기서 나온다.
    await page.getByRole('heading', { name: '방문 정보' }).scrollIntoViewIfNeeded().catch(() => {})
    await shot(page, 'a05-result-visit', {
      check: () => page.getByRole('heading', { name: '방문 정보' }).waitFor({ state: 'visible', timeout: 20_000 }),
      settle: 2500,
    })

    // A-11 공유 카드 — ResultScreen.tsx:481
    await page.getByRole('button', { name: '공유 카드 만들기' }).click().catch(() => {})
    await shot(page, 'a11-share-card', { settle: 4000 })
    await goBack(page).catch(() => {})

    // A-6 코스 — ResultScreen.tsx:418-425 "이 방향으로 코스 짜기"
    await page.getByRole('button', { name: /이 방향으로 코스 짜기/ }).click().catch(() => {})
    await shot(page, 'a07-course', {
      check: () => page.getByRole('button', { name: '코스 안내 시작' }).waitFor({ state: 'visible', timeout: 30_000 }),
      settle: 3500,
    })

    // A-7 코스 안내 1단계 — CourseScreen.tsx:329
    await page.getByRole('button', { name: '코스 안내 시작' }).click().catch(() => {})
    await shot(page, 'a08-course-guide', { settle: 3000 })
  }

  console.log('[명소 지도 · 도장]')
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.getByRole('navigation', { name: '주요 메뉴' }).waitFor({ state: 'visible', timeout: 60_000 })
  await page.addStyleTag({ content: SAFE_AREA_CSS })
  await sleep(2000)

  // A-5 명소 지도 — 혼잡/쾌적 배지(map/congestionStatus.ts:11-12)가 집중률 예측 API의 증거다.
  await goTab(page, '명소')
  await shot(page, 'a06-spots-map', {
    check: () => page.getByText(/오늘 혼잡 예상|오늘 가기 좋아요/).first().waitFor({ state: 'visible', timeout: 45_000 }),
    settle: 6000,
  })

  // A-9 도장 — VISITED_SEED가 반영된 상태
  await goTab(page, '도장')
  await shot(page, 'a10-stamp', { settle: 2500 })

  await browser.close()

  // 자동 점검: 장수와 폭
  console.log('\n=== 결과 ===')
  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.png'))
  console.log(`생성 ${captured.length}장 / 디렉터리 내 ${files.length}장`)
  const wrongWidth = captured.filter((c) => c.w !== DOC_WIDTH)
  if (wrongWidth.length) console.log(`폭 불일치: ${wrongWidth.map((c) => c.name).join(', ')}`)
  if (failures.length) {
    console.log('\n실패:')
    for (const f of failures) console.log(`  - ${f.name}: ${f.reason}`)
    process.exitCode = 1
  } else {
    console.log('실패 없음')
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
