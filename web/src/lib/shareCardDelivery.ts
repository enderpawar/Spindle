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
 * 좌표·방위각은 카드에도 파일명에도 들어가지 않는다 (절대 원칙 1).
 *
 * ⚠ 파일 수명은 절대 원칙 3(TourAPI 응답 영속 저장 금지)과 맞닿아 있다. 카드에는 관광지명과
 * TourAPI 대표 이미지가 들어가므로, 앱 캐시에 사본이 무기한 쌓이면 "적재"로 읽힐 수 있다.
 * 그래서 **파일명을 고정**한다 — 이름이 하나면 존재할 수 있는 사본도 항상 최대 한 개다.
 * 매 공유 시작 시 그 하나를 먼저 지우고 새로 쓰므로, 앱을 껐다 켜도 직전 카드 한 장만 남고
 * 그마저 다음 공유에서 사라진다. (공유 직후에 지우면 수신 앱이 스트림을 읽기 전에 파일이
 * 없어질 수 있어 경합이 난다 — 그래서 "쓰기 직전 정리"로 잡는다.)
 * 파일명이 POI별로 다르면 이 상한이 깨지므로 파일명을 인자로 받지 않는다.
 */

/** 앱에서 공유 시트를 쓸 수 있는가 — 웹에서는 항상 false다. */
export function canUseNativeShareSheet(): boolean {
  return isNativeShell()
}

export type NativeShareResult = 'shared' | 'dismissed' | 'failed'

interface NativeShareInput {
  blob: Blob
  title: string
  text: string
}

/**
 * 공유 카드가 쓰이는 유일한 경로. 고정 이름이라 캐시에 남는 사본은 항상 최대 한 개다.
 * 받는 앱에는 이 이름이 보인다 — POI명을 넣으면 사본 상한이 깨지므로 일부러 일반명으로 둔다.
 */
const SHARE_CARD_PATH = 'spindle-share-card.png'

/** 쓰기→공유→정리 구간을 직렬화한다. 연타·중복 호출이 서로의 파일을 지우지 못하게 막는다. */
let inFlight: Promise<NativeShareResult> | null = null

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
 *
 * 넓은 정규식(`/cancel|dismiss|abort/i`)을 쓰지 않는다. 파일 I/O가 "aborted"됐다는 **진짜 실패**까지
 * 취소로 삼켜 사용자에게 아무 말도 하지 않게 된다. 설치본이 실제로 내는 취소 메시지만 허용한다.
 */
const SHARE_CANCEL_MESSAGES = ['share canceled', 'share cancelled']

export function isShareDismissal(error: unknown): boolean {
  // Web Share API 계열이 섞여 들어오는 경우까지만 이름으로 추가 허용한다.
  if (error instanceof Error && error.name === 'AbortError') return true
  const message = (error instanceof Error ? error.message : String(error ?? '')).trim().toLowerCase()
  return SHARE_CANCEL_MESSAGES.includes(message)
}

export function shareCardViaNativeSheet(input: NativeShareInput): Promise<NativeShareResult> {
  if (!isNativeShell()) return Promise.resolve('failed')
  // 앞선 공유가 아직 진행 중이면 그 결과를 그대로 돌려준다. 새로 파일을 쓰면 진행 중인
  // 공유가 참조하는 파일을 지워 버린다 (플러그인도 두 번째 share를 거절한다).
  if (inFlight) return inFlight

  const run = deliver(input).finally(() => {
    inFlight = null
  })
  inFlight = run
  return run
}

async function deliver(input: NativeShareInput): Promise<NativeShareResult> {
  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])

    // 직전 카드를 먼저 치운다 — 앱을 껐다 켠 뒤에도 확실히 지우려면 경로가 고정이어야 한다.
    // 파일이 없으면 플러그인이 거부하므로 실패는 무시하고 진행한다.
    try {
      await Filesystem.deleteFile({ path: SHARE_CARD_PATH, directory: Directory.Cache })
    } catch {
      // 남은 카드가 없는 정상 상태다 — 무시한다
    }

    const written = await Filesystem.writeFile({
      path: SHARE_CARD_PATH,
      data: await blobToBase64(input.blob),
      directory: Directory.Cache,
    })

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
