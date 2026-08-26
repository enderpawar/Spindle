import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** 지도 청크를 처음부터 다시 받아 보게 한다 — 부모가 key를 갈아 이 경계를 새로 마운트한다. */
  onRetry: () => void
}

interface State {
  hasError: boolean
}

/**
 * 지도 서브트리 전용 에러 경계.
 *
 * 지도 구현(`KakaoMapView`·`LocalMapView`)은 지연 로드되므로, 이동 중 연결이 끊기면
 * 청크 요청이 실패하고 렌더가 예외를 던진다. 이 경계가 없으면 그 예외가 `AppErrorBoundary`까지
 * 올라가 **앱 화면 전체**가 오류 화면으로 바뀐다 — 목록 모드로 계속 볼 수 있는 상황인데도.
 *
 * 여기서 막아 지도 자리에만 안내를 띄우고, 나머지 화면(목록·탭·시트)은 그대로 살려 둔다.
 * 원격 전송 없이 콘솔에만 남긴다 (수집 없는 서비스 — AGENTS.md 절대 원칙 5).
 */
export class MapChunkBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Spindle] 지도를 그리는 중 오류가 발생했습니다.', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div role="alert" style={styles.wrap}>
        <div style={styles.card}>
          <p style={styles.title}>지도를 불러오지 못했어요</p>
          <p style={styles.body}>연결을 확인한 뒤 다시 시도해 주세요. 목록으로는 계속 둘러볼 수 있어요.</p>
          <button type="button" style={styles.button} onClick={this.props.onRetry}>
            다시 시도
          </button>
        </div>
      </div>
    )
  }
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    padding: 20,
    background: '#c3dcf9',
  },
  card: {
    maxWidth: 280,
    padding: '18px 18px 16px',
    borderRadius: 16,
    background: '#fff',
    boxShadow: '0 10px 30px -12px rgba(20,50,140,.45)',
    textAlign: 'center',
  },
  title: { margin: 0, fontSize: 15, fontWeight: 800, color: '#17347f' },
  body: { margin: '8px 0 14px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.6, color: '#5a76a8' },
  button: {
    minHeight: 44,
    width: '100%',
    border: 0,
    borderRadius: 12,
    background: '#2f5cff',
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
}
