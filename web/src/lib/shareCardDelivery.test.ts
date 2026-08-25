import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canUseNativeShareSheet, isShareDismissal, shareCardViaNativeSheet, stripDataUrlPrefix } from './shareCardDelivery'

/**
 * 네이티브 경로 테스트.
 *
 * `vite.config.ts`는 `mode !== 'app'`일 때 두 플러그인을 스텁으로 바꿔 끼우므로, vitest에서는
 * 스텁이 로드된다. 그 스텁을 `vi.mock`으로 가로채 호출 순서·인자·정리 동작을 검증한다.
 * 여기서 보는 것은 실제 안드로이드 동작이 아니라 **우리 코드의 계약**이다 — 시트가 실제로 뜨는지,
 * 수신 앱이 PNG를 받는지는 실기기 확인 목록(GOOGLE_PLAY_RELEASE.md)에서 사람이 본다.
 */
const writeFile = vi.fn()
const deleteFile = vi.fn()
const share = vi.fn()

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: (...args: unknown[]) => writeFile(...args),
    deleteFile: (...args: unknown[]) => deleteFile(...args),
  },
}))
vi.mock('@capacitor/share', () => ({
  Share: { share: (...args: unknown[]) => share(...args) },
}))

interface Global {
  Capacitor?: { isNativePlatform?: () => boolean }
  FileReader?: unknown
}

/** base64 변환은 FileReader에 기대는데 node 환경에는 없다 — 계약만 맞춰 세운다. */
class FakeFileReader {
  result: string | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  readAsDataURL() {
    this.result = 'data:image/png;base64,UE5H'
    queueMicrotask(() => this.onload?.())
  }
}

const blob = { type: 'image/png' } as Blob
const input = { blob, title: 'Spindle', text: '오늘의 방향은 동쪽 — 흰여울문화마을' }

beforeEach(() => {
  writeFile.mockReset().mockResolvedValue({ uri: 'file:///data/cache/spindle-share-card.png' })
  deleteFile.mockReset().mockResolvedValue(undefined)
  share.mockReset().mockResolvedValue({ activityType: 'com.kakao.talk' })
  ;(globalThis as Global).Capacitor = { isNativePlatform: () => true }
  ;(globalThis as Global).FileReader = FakeFileReader
})

afterEach(() => {
  delete (globalThis as Global).Capacitor
  delete (globalThis as Global).FileReader
})

describe('canUseNativeShareSheet', () => {
  it('네이티브 셸 안에서만 true다 — 웹은 기존 Web Share 경로를 쓴다', () => {
    expect(canUseNativeShareSheet()).toBe(true)
    delete (globalThis as Global).Capacitor
    expect(canUseNativeShareSheet()).toBe(false)
  })
})

describe('shareCardViaNativeSheet', () => {
  it('웹에서 잘못 호출되면 플러그인을 건드리지 않고 실패로 끝낸다', async () => {
    delete (globalThis as Global).Capacitor
    await expect(shareCardViaNativeSheet(input)).resolves.toBe('failed')
    expect(writeFile).not.toHaveBeenCalled()
    expect(share).not.toHaveBeenCalled()
  })

  it('직전 카드를 지우고 → 캐시에 쓰고 → 그 file:// URI로 시트를 연다', async () => {
    await expect(shareCardViaNativeSheet(input)).resolves.toBe('shared')

    expect(deleteFile).toHaveBeenCalledWith({ path: 'spindle-share-card.png', directory: 'CACHE' })
    expect(writeFile).toHaveBeenCalledWith({
      path: 'spindle-share-card.png',
      data: 'UE5H', // data URL 접두사가 떨어진 본문만 넘어간다
      directory: 'CACHE',
    })
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['file:///data/cache/spindle-share-card.png'], text: input.text }),
    )
    // 삭제가 쓰기보다 먼저다 — 반대면 방금 쓴 카드를 지운다
    expect(deleteFile.mock.invocationCallOrder[0]).toBeLessThan(writeFile.mock.invocationCallOrder[0])
  })

  it('캐시에 남는 사본을 한 장으로 묶는다 — 매번 같은 경로를 쓴다 (절대 원칙 3)', async () => {
    await shareCardViaNativeSheet(input)
    await shareCardViaNativeSheet({ ...input, text: '다른 장소' })

    const paths = writeFile.mock.calls.map(([opts]) => (opts as { path: string }).path)
    expect(new Set(paths).size).toBe(1)
    // 두 번째 공유도 쓰기 전에 직전 파일을 지운다
    expect(deleteFile).toHaveBeenCalledTimes(2)
  })

  it('지울 파일이 없어도(첫 공유·앱 재설치) 공유를 계속한다', async () => {
    deleteFile.mockRejectedValue(new Error('File does not exist'))
    await expect(shareCardViaNativeSheet(input)).resolves.toBe('shared')
    expect(share).toHaveBeenCalledTimes(1)
  })

  it('사용자가 시트를 닫으면 실패가 아니라 dismissed다 — 오류 문구를 띄우면 안 된다', async () => {
    share.mockRejectedValue(new Error('Share canceled'))
    await expect(shareCardViaNativeSheet(input)).resolves.toBe('dismissed')
  })

  it('진짜 실패는 failed로 돌려준다', async () => {
    share.mockRejectedValue(new Error('only file urls are supported'))
    await expect(shareCardViaNativeSheet(input)).resolves.toBe('failed')
  })

  it('파일 쓰기가 실패하면 시트를 열지 않는다', async () => {
    writeFile.mockRejectedValue(new Error('EACCES'))
    await expect(shareCardViaNativeSheet(input)).resolves.toBe('failed')
    expect(share).not.toHaveBeenCalled()
  })

  it('연타해도 파일 작업이 겹치지 않는다 — 진행 중인 공유 결과를 그대로 돌려준다', async () => {
    const [a, b] = await Promise.all([shareCardViaNativeSheet(input), shareCardViaNativeSheet(input)])

    expect(a).toBe('shared')
    expect(b).toBe('shared')
    // 두 번째 호출이 진행 중인 공유의 파일을 지우거나 덮어쓰지 않았다
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(deleteFile).toHaveBeenCalledTimes(1)
    expect(share).toHaveBeenCalledTimes(1)
  })

  it('앞선 공유가 끝난 뒤에는 다시 공유할 수 있다 (잠금이 풀린다)', async () => {
    share.mockRejectedValueOnce(new Error('Share canceled'))
    await expect(shareCardViaNativeSheet(input)).resolves.toBe('dismissed')
    await expect(shareCardViaNativeSheet(input)).resolves.toBe('shared')
    expect(share).toHaveBeenCalledTimes(2)
  })
})

describe('stripDataUrlPrefix', () => {
  it('data URL 접두사를 떼고 base64 본문만 남긴다', () => {
    expect(stripDataUrlPrefix('data:image/png;base64,iVBORw0KGgo=')).toBe('iVBORw0KGgo=')
  })

  it('접두사가 없으면 그대로 둔다', () => {
    expect(stripDataUrlPrefix('iVBORw0KGgo=')).toBe('iVBORw0KGgo=')
  })
})

describe('isShareDismissal', () => {
  it('플러그인이 실제로 내는 취소 메시지만 취소로 본다', () => {
    expect(isShareDismissal(new Error('Share canceled'))).toBe(true)
    expect(isShareDismissal(new Error('share cancelled'))).toBe(true)
    const aborted = new Error('The operation was aborted')
    aborted.name = 'AbortError'
    expect(isShareDismissal(aborted)).toBe(true)
  })

  it('진짜 실패를 취소로 삼키지 않는다 — 넓은 정규식이었다면 놓쳤을 것들', () => {
    expect(isShareDismissal(new Error('file write aborted'))).toBe(false)
    expect(isShareDismissal(new Error('Can\'t share while sharing is in progress'))).toBe(false)
    expect(isShareDismissal(new Error('only file urls are supported'))).toBe(false)
    expect(isShareDismissal(undefined)).toBe(false)
  })
})
