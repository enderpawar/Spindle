// 공유 이미지 카드 — 인스타 스토리 비율(1080×1920) PNG를 Canvas로 그린다 (ui.md S5).
// 출처 표기가 필요해도 "TourAPI"로만 — 절대 원칙 6.

const W = 1080
const H = 1920
const FONT = `'Pretendard Variable', Pretendard, -apple-system, sans-serif`

interface ShareCardInput {
  poiName: string
  districtLine: string
  message: string
  directionLabel: string
  color: string
  imageUrl?: string
}

/** 한글은 어절 단위 줄바꿈이 자주 실패하므로 글자 단위로 감싼다 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line !== '') {
      lines.push(line.trimEnd())
      line = ch === ' ' ? '' : ch
    } else {
      line += ch
    }
  }
  if (line) lines.push(line.trimEnd())
  return lines
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, fill: string) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(size * 0.25, -size * 0.25)
  ctx.lineTo(size, 0)
  ctx.lineTo(size * 0.25, size * 0.25)
  ctx.lineTo(0, size)
  ctx.lineTo(-size * 0.25, size * 0.25)
  ctx.lineTo(-size, 0)
  ctx.lineTo(-size * 0.25, -size * 0.25)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function loadCardImage(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawCoverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  const sx = (img.naturalWidth - sw) / 2
  const sy = (img.naturalHeight - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function drawImagePanel(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) {
  const x = 120
  const y = 850
  const w = 840
  const h = 520
  ctx.save()
  drawRoundedRect(ctx, x, y, w, h, 48)
  ctx.clip()
  if (img) {
    try {
      drawCoverImage(ctx, img, x, y, w, h)
      ctx.fillStyle = 'rgba(0,0,0,.18)'
      ctx.fillRect(x, y, w, h)
    } catch {
      img = null
    }
  }
  if (!img) {
    const panel = ctx.createLinearGradient(x, y, x + w, y + h)
    panel.addColorStop(0, 'rgba(255,255,255,.18)')
    panel.addColorStop(1, 'rgba(8,20,38,.35)')
    ctx.fillStyle = panel
    ctx.fillRect(x, y, w, h)
    drawStar(ctx, x + w / 2, y + h / 2, 78, 'rgba(255,255,255,.72)')
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,255,255,.32)'
  ctx.lineWidth = 2
  drawRoundedRect(ctx, x, y, w, h, 48)
  ctx.stroke()
}

export async function buildShareCardBlob(input: ShareCardInput): Promise<Blob> {
  await document.fonts.ready
  const cardImage = await loadCardImage(input.imageUrl)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // 배경 — 방위 색이 밤바다로 가라앉는 그라디언트
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, input.color)
  bg.addColorStop(0.42, '#16304f')
  bg.addColorStop(1, '#081426')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 별
  const stars: [number, number, number][] = [
    [130, 820, 4], [905, 700, 3], [540, 640, 3], [220, 1180, 3], [880, 1260, 4], [430, 1520, 3],
  ]
  for (const [x, y, r] of stars) {
    ctx.fillStyle = 'rgba(255,255,255,.7)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // 상단 로고
  drawStar(ctx, W / 2, 190, 46, 'rgba(255,255,255,.92)')
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.font = `900 54px ${FONT}`
  ctx.fillText('Spindle', W / 2, 316)

  // 방위 칩
  ctx.font = `900 44px ${FONT}`
  const chipLabel = `${input.directionLabel}쪽`
  const chipW = ctx.measureText(chipLabel).width + 96
  ctx.fillStyle = 'rgba(8,20,38,.55)'
  ctx.beginPath()
  ctx.roundRect((W - chipW) / 2, 470, chipW, 100, 50)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillText(chipLabel, W / 2, 537)

  // 큐레이션 메시지
  ctx.font = `700 46px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,.85)'
  const messageLines = wrapText(ctx, input.message, 860)
  messageLines.forEach((line, i) => ctx.fillText(line, W / 2, 700 + i * 68))

  drawImagePanel(ctx, cardImage)

  // 관광지명
  ctx.font = `900 86px ${FONT}`
  ctx.fillStyle = '#ffffff'
  const nameLines = wrapText(ctx, input.poiName, 920).slice(0, 3)
  const nameTop = 1510
  nameLines.forEach((line, i) => ctx.fillText(line, W / 2, nameTop + i * 104))

  ctx.font = `600 40px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,.6)'
  ctx.fillText(input.districtLine, W / 2, nameTop + nameLines.length * 104 + 28)

  // 푸터
  ctx.font = `700 36px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,.55)'
  ctx.fillText('Spindle이 정해준 오늘의 방향', W / 2, H - 130)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('공유 카드 생성 실패'))), 'image/png')
  })
}
