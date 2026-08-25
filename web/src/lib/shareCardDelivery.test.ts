import { afterEach, describe, expect, it } from 'vitest'
import { canUseNativeShareSheet, isShareDismissal, shareCardViaNativeSheet, stripDataUrlPrefix } from './shareCardDelivery'

interface Global {
  Capacitor?: { isNativePlatform?: () => boolean }
}

afterEach(() => {
  delete (globalThis as Global).Capacitor
})

describe('canUseNativeShareSheet', () => {
  it('브라우저에는 Capacitor 전역이 없으므로 false다 — 웹은 기존 Web Share 경로를 쓴다', () => {
    expect(canUseNativeShareSheet()).toBe(false)
  })

  it('네이티브 셸 안에서는 true다', () => {
    ;(globalThis as Global).Capacitor = { isNativePlatform: () => true }
    expect(canUseNativeShareSheet()).toBe(true)
  })
})

describe('shareCardViaNativeSheet', () => {
  it('웹에서 잘못 호출되면 플러그인을 건드리지 않고 실패로 끝낸다', async () => {
    const blob = { type: 'image/png' } as Blob
    await expect(shareCardViaNativeSheet({ blob, fileName: 'a.png', title: 'Spindle', text: 't' })).resolves.toBe('failed')
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
  it('사용자가 시트를 닫은 것은 실패가 아니다 — 오류 문구를 띄우면 안 된다', () => {
    expect(isShareDismissal(new Error('Share canceled'))).toBe(true)
    expect(isShareDismissal(new Error('Activity was dismissed'))).toBe(true)
    expect(isShareDismissal(new Error('AbortError'))).toBe(true)
  })

  it('진짜 실패는 실패로 남긴다', () => {
    expect(isShareDismissal(new Error('Can\'t share while sharing is in progress'))).toBe(false)
    expect(isShareDismissal(new Error('only file urls are supported'))).toBe(false)
    expect(isShareDismissal(undefined)).toBe(false)
  })
})
