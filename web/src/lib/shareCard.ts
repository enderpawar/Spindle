// Shared 1080×1920 light-theme travel postcard, used for both preview and delivery.
const W = 1080
const H = 1920
const FONT = "'Pretendard Variable', Pretendard, -apple-system, sans-serif"
const INK = '#17347f'
const BLUE = '#2f5cff'
const MUTED = '#5b7098'

interface ShareCardInput {
  poiName: string
  districtLine: string
  message: string
  directionLabel: string
  color: string
  imageUrl?: string
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line.trimEnd())
      line = ''
    } else if (ctx.measureText(line + ch).width > width && line !== '') {
      lines.push(line.trimEnd())
      line = ch === ' ' ? '' : ch
    } else line += ch
  }
  if (line) lines.push(line.trimEnd())
  return lines
}

function fitLines(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number, size: number, minSize: number, weight: number) {
  let lines: string[]
  do {
    ctx.font = weight + ' ' + size + 'px ' + FONT
    lines = wrapText(ctx, text, width)
    if (lines.length <= maxLines || size <= minSize) break
    size -= 2
  } while (size >= minSize)
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    let last = lines[maxLines - 1]
    while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1)
    lines[maxLines - 1] = last + '…'
  }
  return { lines, size }
}

function loadCardImage(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    const timer = window.setTimeout(() => finish(null), 12000)
    const finish = (image: HTMLImageElement | null) => {
      window.clearTimeout(timer)
      img.onload = null
      img.onerror = null
      resolve(image)
    }
    img.crossOrigin = 'anonymous'
    img.onload = () => finish(img.naturalWidth > 0 ? img : null)
    img.onerror = () => finish(null)
    img.src = url
  })
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.fill()
}

function drawSeascape(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const sky = ctx.createLinearGradient(x, y, x + w, y + h)
  sky.addColorStop(0, '#e6f4ff')
  sky.addColorStop(1, '#bde7f0')
  ctx.fillStyle = sky
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x + w * 0.77, y + h * 0.23, 61, 0, Math.PI * 2)
  ctx.fill()
  for (const [offset, color] of [[0.64, '#a3dae9'], [0.77, '#69c3de'], [0.91, '#3899da']] as const) {
    const top = y + h * offset
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.bezierCurveTo(x + w * 0.3, top - 105, x + w * 0.6, top + 100, x + w, top - 30)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.fill()
  }
  // Photo fallback uses a compass, distinct from the current brand mark.
  const cx = x + w * 0.5
  const cy = y + h * 0.4
  ctx.strokeStyle = 'rgba(47,92,255,.22)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, 128, 0, Math.PI * 2)
  ctx.stroke()
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(Math.PI / 6)
  for (const [sign, color] of [[1, BLUE], [-1, '#ffffff']] as const) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, -93 * sign)
    ctx.lineTo(30 * sign, 18 * sign)
    ctx.lineTo(0, 0)
    ctx.lineTo(-30 * sign, -18 * sign)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

export async function buildShareCardBlob(input: ShareCardInput): Promise<Blob> {
  // Canvas text does not trigger unicode-range font downloads like DOM text does.
  const fontText = `${input.poiName} ${input.message} ${input.districtLine} ${input.directionLabel} Spindle BUSAN TODAY’S PICK 오늘의 방향이 데려다준 곳 쪽으로 만난 부산 정해준 출처: ⓒ한국관광공사`
  await document.fonts.load('800 88px "Pretendard Variable"', fontText).catch(() => [])
  await document.fonts.ready
  const [photo, brand] = await Promise.all([loadCardImage(input.imageUrl), loadCardImage('/brand-mark-192.png')])
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('공유 카드를 만들 수 없어요')

  ctx.fillStyle = '#f4f8ff'
  ctx.fillRect(0, 0, W, H)
  roundedRect(ctx, 44, 44, 992, 1832, 64, '#ffffff')
  ctx.strokeStyle = '#dbe6fa'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  if (brand) ctx.drawImage(brand, 100, 104, 82, 82)
  ctx.fillStyle = INK
  ctx.font = '800 48px ' + FONT
  ctx.fillText('Spindle', brand ? 201 : 104, 164)
  ctx.fillStyle = MUTED
  ctx.font = '600 27px ' + FONT
  ctx.textAlign = 'right'
  ctx.fillText('BUSAN · TODAY’S PICK', 976, 153)
  ctx.textAlign = 'left'

  ctx.fillStyle = MUTED
  ctx.font = '600 36px ' + FONT
  ctx.fillText('오늘의 방향이 데려다준 곳', 104, 280)
  ctx.fillStyle = INK
  const title = fitLines(ctx, input.poiName, 872, 3, 88, 56, 800)
  const titleLineHeight = title.size * 1.2
  title.lines.forEach((line, i) => ctx.fillText(line, 100, 389 + i * titleLineHeight))
  const metadataY = 389 + (title.lines.length - 1) * titleLineHeight + 70
  ctx.fillStyle = MUTED
  const metadata = fitLines(ctx, input.districtLine, 872, 1, 34, 26, 500)
  ctx.fillText(metadata.lines[0] ?? '', 104, metadataY)

  const photoY = Math.max(570, metadataY + 57)
  const photoH = 1264 - photoY
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(100, photoY, 880, photoH, 36)
  ctx.clip()
  if (photo) {
    const scale = Math.max(880 / photo.naturalWidth, photoH / photo.naturalHeight)
    const sw = 880 / scale
    const sh = photoH / scale
    ctx.drawImage(photo, (photo.naturalWidth - sw) / 2, (photo.naturalHeight - sh) / 2, sw, sh, 100, photoY, 880, photoH)
  } else drawSeascape(ctx, 100, photoY, 880, photoH)
  ctx.restore()

  const chip = input.directionLabel + '쪽으로 만난 부산'
  ctx.font = '700 32px ' + FONT
  const chipWidth = ctx.measureText(chip).width + 68
  roundedRect(ctx, 104, 1332, chipWidth, 70, 35, '#e8f0ff')
  ctx.fillStyle = BLUE
  ctx.fillText(chip, 138, 1379)
  ctx.fillStyle = INK
  const message = fitLines(ctx, input.message, 864, 3, 46, 36, 700)
  message.lines.forEach((line, i) => ctx.fillText(line, 104, 1486 + i * 64))

  ctx.strokeStyle = '#dbe6fa'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(104, 1720)
  ctx.lineTo(976, 1720)
  ctx.stroke()
  ctx.fillStyle = MUTED
  ctx.font = '500 30px ' + FONT
  ctx.fillText('Spindle이 정해준 오늘의 방향', 104, 1781)
  ctx.font = '500 26px ' + FONT
  ctx.fillText('출처: ⓒ한국관광공사', 104, 1825)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('공유 카드 생성 실패')), 'image/png')
  })
}
