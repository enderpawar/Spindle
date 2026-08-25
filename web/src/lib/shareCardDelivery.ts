import { isNativeShell } from '../native/shell'

/**
 * 공유 카드 PNG를 어디로 내보낼지 결정하고 실행한다.
 *
 * 웹과 앱은 내보내는 수단이 완전히 다르다.
 *  - 웹(브라우저·PWA): Web Share API(`navigator.share`) + `<a download>` 저장 폴백. 지금까지의 경로.
 *  - 앱(Capacitor WebView): **둘 다 동작하지 않는다.** 안드로이드 WebView는 Web Share API를
 *    구현하지 않아 `navigator.share`가 아예 없고, Capacitor는 `setDownloadListener`를 걸지
 *    않으므로 `<a download>`의 blob 저장이 조용히 무시된다(설치본 소스 확인). 즉 앱에서는
 *    공유 카드가 화면 밖으로 나갈 방법이 없었다.
 *
 * 그래서 앱에서는 PNG를 캐시 디렉터리에 파일로 쓴 뒤 **안드로이드 공유 시트**로 넘긴다.
 * 사진 앱·메신저·드라이브·파일 등 저장까지 시트가 한 번에 처리한다.
 *
 * 플러그인은 `useHardwareBack`과 같은 규약으로 다룬다 — 네이티브 판정 뒤에서만 동적 import 하고,
 * 웹 빌드에서는 `vite.config.ts`가 스텁으로 바꿔 끼워 산출물·service worker precache에서 뺀다.
 *
 * 좌표·방위각은 카드에도 파일명에도 들어가지 않는다 (절대 원칙 1). 파일은 앱 내부 캐시에만
 * 쓰고 다음 공유 때 지운다 — TourAPI 응답을 영속 저장하는 것이 아니다 (절대 원칙 3).
 */

/** 앱에서 공유 시트를 쓸 수 있는가 — 웹에서는 항상 false다. */
export function canUseNativeShareSheet(): boolean {
  return isNativeShell()
}

export type NativeShareResult = 'shared' | 'dismissed' | 'failed'

interface NativeShareInput {
  blob: Blob
  /** 받는 앱에 보이는 파일명 — 좌표가 아닌 방위·POI id만 담는다 */
  fileName: string
  title: string
  text: string
}

/** 직전에 캐시에 쓴 파일 — 다음 공유 때 지워 캐시에 카드가 쌓이지 않게 한다. */
let lastWrittenPath: string | null = null

/**
 * `FileReader`가 주는 `data:image/png;base64,....`에서 본문만 떼어낸다.
 * Filesystem 플러그인은 접두사가 붙은 채로 받으면 깨진 파일을 쓴다.
 */
export function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('공유 카드를 읽지 못했습니다'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('공유 카드를 읽지 못했습니다'))
        return
      }
      resolve(stripDataUrlPrefix(result))
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * 사용자가 공유 시트를 그냥 닫은 경우와 진짜 실패를 구분한다.
 * 플러그인은 취소도 reject로 돌려주므로 메시지로 가른다 — 취소에 오류 문구를 띄우면 안 된다.
 * (안드로이드 `SharePlugin`은 "Share canceled", iOS는 "Share canceled"/dismiss 계열을 준다)
 */
export function isShareDismissal(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /cancel|dismiss|abort/i.test(message)
}

export async function shareCardViaNativeSheet(input: NativeShareInput): Promise<NativeShareResult> {
  if (!isNativeShell()) return 'failed'

  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])

    // 직전 카드를 먼저 치운다. 실패해도 공유는 진행한다 (캐시는 OS가 회수한다).
    if (lastWrittenPath) {
      const stale = lastWrittenPath
      lastWrittenPath = null
      try {
        await Filesystem.deleteFile({ path: stale, directory: Directory.Cache })
      } catch {
        // 이미 OS가 지웠을 수 있다 — 무시한다
      }
    }

    const written = await Filesystem.writeFile({
      path: input.fileName,
      data: await blobToBase64(input.blob),
      directory: Directory.Cache,
    })
    lastWrittenPath = input.fileName

    // Share 플러그인은 file:// URL만 받고, 내부적으로 `${applicationId}.fileprovider`로 감싼다.
    // `res/xml/file_paths.xml`의 `cache-path`가 Directory.Cache(=context.cacheDir)를 덮는다.
    await Share.share({
      title: input.title,
      text: input.text,
      files: [written.uri],
      dialogTitle: '공유 카드 보내기',
    })
    return 'shared'
  } catch (error) {
    if (isShareDismissal(error)) return 'dismissed'
    console.warn('[Spindle] 공유 시트를 열지 못했습니다.', error)
    return 'failed'
  }
}
