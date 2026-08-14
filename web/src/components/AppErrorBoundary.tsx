import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * 앱 전역 에러 경계.
 *
 * 이게 없으면 렌더 중 예외 하나로 React 트리 전체가 언마운트돼 **검은 빈 화면**이 남는다.
 * 네이티브 앱(Capacitor)에서는 브라우저 주소창이 없어 사용자가 새로고침할 수단조차 없고,
 * 스토어 심사자가 이 상태를 만나면 "앱이 동작하지 않는다"로 리젝된다.
 *
 * 실제로 에뮬레이터에서 모든 API 호출이 차단된 상태로 스핀 화면에 진입했을 때
 * 빈 화면 + ANR(Input dispatching timed out)이 재현됐다.
 *
 * 외부 자산(폰트·이미지·네트워크)에 의존하지 않는다 — 오프라인에서 표시되는 화면이므로.
 */

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  /** 오프라인이 원인으로 보이면 안내 문구를 바꾼다. */
  wasOffline: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, wasOffline: false }

  static getDerivedStateFromError(): Partial<State> {
    return {
      hasError: true,
      // navigator.onLine은 "랜선이 꽂혀 있다" 수준의 신호라 참일 때도 실제로는 끊겼을 수 있다.
      // 거짓일 때만 오프라인이라고 단정한다.
      wasOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 원격 전송 없이 콘솔에만 남긴다 (수집 없는 서비스 — AGENTS.md 절대 원칙 5).
    console.error('[Spindle] 화면을 그리는 중 오류가 발생했습니다.', error, info.componentStack)
  }

  private readonly handleRetry = (): void => {
    this.setState({ hasError: false, wasOffline: false })
  }

  private readonly handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    const title = this.state.wasOffline ? '네트워크가 필요해요' : '잠시 문제가 생겼어요'
    const body = this.state.wasOffline
      ? '관광지 정보를 실시간으로 불러오는 서비스예요. 연결을 확인한 뒤 다시 시도해 주세요.'
      : '화면을 그리는 중 문제가 생겼어요. 다시 시도하면 대부분 해결돼요.'

    return (
      <div role="alert" style={styles.wrap}>
        <div style={styles.card}>
          <div aria-hidden style={styles.mark}>
            <svg viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="">
              <circle cx="24" cy="24" r="21" fill="none" stroke="#dbe6fa" strokeWidth="4" />
              <path d="M24 13v14" stroke="#17347f" strokeWidth="4" strokeLinecap="round" />
              <circle cx="24" cy="34" r="2.6" fill="#17347f" />
            </svg>
          </div>
          <h1 style={styles.title}>{title}</h1>
          <p style={styles.body}>{body}</p>
          <div style={styles.actions}>
            <button type="button" onClick={this.handleRetry} style={styles.primary}>
              다시 시도
            </button>
            <button type="button" onClick={this.handleReload} style={styles.secondary}>
              앱 새로 열기
            </button>
          </div>
        </div>
      </div>
    )
  }
}

const styles = {
  wrap: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: '#f4f8ff',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    textAlign: 'center',
  },
  mark: { marginBottom: 18 },
  title: {
    margin: '0 0 10px',
    fontSize: 20,
    fontWeight: 800,
    color: '#17347f',
    letterSpacing: '-0.01em',
  },
  body: {
    margin: '0 0 24px',
    fontSize: 14.5,
    lineHeight: 1.6,
    color: '#5b7098',
    wordBreak: 'keep-all',
  },
  actions: { display: 'grid', gap: 10 },
  primary: {
    padding: '14px 18px',
    fontSize: 15,
    fontWeight: 700,
    color: '#ffffff',
    background: '#2f6bff',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
  },
  secondary: {
    padding: '13px 18px',
    fontSize: 14.5,
    fontWeight: 600,
    color: '#3a4c78',
    background: 'transparent',
    border: '1px solid #dbe6fa',
    borderRadius: 14,
    cursor: 'pointer',
  },
} as const satisfies Record<string, React.CSSProperties>
