import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Local-only synthetic data: never stores TourAPI responses.
const base = process.argv[2] ?? 'http://127.0.0.1:5174'
const out = join(tmpdir(), 'spindle-share-review')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 503, body: '{}' }))
  await page.route(base + '/share-review', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body><div id="root"></div><script type="module" src="/@vite/client"></script></body></html>' }))
  await page.goto(base + '/share-review')
  await page.evaluate(async () => {
    const { default: RefreshRuntime } = await import('/@react-refresh')
    RefreshRuntime.injectIntoGlobalHook(window)
    window.$RefreshReg$ = () => {}
    window.$RefreshSig$ = () => type => type
    window.__vite_plugin_react_preamble_installed__ = true
    await import('/src/index.css')
    await import('/src/mobile-pwa.css')
    await import('/node_modules/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css')
    const ReactModule = await import('/node_modules/.vite/deps/react.js')
    const React = ReactModule.default ?? ReactModule
    const DomModule = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { createRoot } = DomModule.default ?? DomModule
    const { ShareScreen } = await import('/src/screens/ShareScreen.tsx')
    window.reviewRoot = createRoot(document.getElementById('root'))
    window.renderReview = name => window.reviewRoot.render(React.createElement(ShareScreen, {
      poi: { id: name, contentId: 'synthetic-review', name, district: '영도구', walkMinutes: 25 },
      rec: { direction: { id: 'SE', label: '남동', color: '#ff7a45', message: '골목 끝에서 만나는 새로운 풍경. 오늘은 이쪽으로 걸어볼까요?' } },
      onBack: () => {},
    }))
    window.renderReview('흰여울문화마을')
  })
  await page.locator('.share-preview > img').waitFor({ timeout: 30000 })
  for (const [width, height] of [[280, 640], [390, 844], [480, 844], [390, 568]]) {
    await page.setViewportSize({ width, height })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.getByRole('button', { name: '이미지로 저장' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${out}/screen-${width}x${height}.png` })
  }
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '이미지로 저장' }).click()
  const download = await downloadEvent
  await download.saveAs(`${out}/card.png`)
  assert.deepEqual(await page.locator('.share-preview > img').evaluate(img => [img.naturalWidth, img.naturalHeight]), [1080, 1920])
  await page.evaluate(() => window.renderReview('부산 원도심과 영도를 잇는 아주 긴 이름의 해양문화전시관 특별전시실'))
  await page.locator('.share-preview > img').waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${out}/long-name.png` })
  // Exercise the renderer with a local image and with an image load failure.
  await page.evaluate(async () => {
    const { buildShareCardBlob } = await import('/src/lib/shareCard.ts')
    for (const [id, imageUrl] of [['image', '/brand-mark-192.png'], ['failed-image', '/missing-review-photo.png']]) {
      const blob = await buildShareCardBlob({ poiName: '부산 여행', districtLine: '부산 영도구 · 걸어서 약 25분', message: '오늘의 방향을 따라 걸어요', directionLabel: '동', color: '#ff7a45', imageUrl })
      const img = document.createElement('img')
      img.id = id
      img.src = URL.createObjectURL(blob)
      document.body.append(img)
      await img.decode()
    }
  })
  for (const id of ['image', 'failed-image']) assert.equal(await page.locator('#' + id).evaluate(img => img.naturalWidth), 1080)
  console.log('PASS: 4 viewports, 1080x1920 download, long name, photo and failed-photo rendering. Artifacts: ' + out)
} finally { await browser.close() }
