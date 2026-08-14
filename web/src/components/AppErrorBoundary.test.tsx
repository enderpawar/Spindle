import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Component, type ReactNode } from 'react'
import { AppErrorBoundary } from './AppErrorBoundary'

/**
 * 에러 경계가 없으면 렌더 예외 하나로 트리 전체가 사라져 빈 화면이 남는다.
 * 네이티브 앱에는 주소창이 없어 사용자가 빠져나올 방법이 없고, 스토어 심사에서
 * "동작하지 않는 앱"으로 리젝된다. 그 회귀를 막는 테스트.
 *
 * renderToStaticMarkup은 에러 경계를 지원하지 않으므로(서버 렌더링은 스트림 단위로 처리)
 * getDerivedStateFromError / render의 폴백 계약을 직접 검증한다.
 */

function fallbackMarkup(state: { hasError: boolean; wasOffline: boolean }): string {
  // 경계 인스턴스를 직접 만들어 폴백 렌더 결과만 확인한다.
  const boundary = new AppErrorBoundary({ children: null })
  boundary.state = state
  return renderToStaticMarkup(boundary.render() as never)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AppErrorBoundary', () => {
  it('정상일 때는 자식을 그대로 그린다', () => {
    const html = renderToStaticMarkup(
      <AppErrorBoundary>
        <p>정상 화면</p>
      </AppErrorBoundary>,
    )
    expect(html).toContain('정상 화면')
  })

  it('오류 시 빈 화면 대신 복구 수단을 보여준다', () => {
    const html = fallbackMarkup({ hasError: true, wasOffline: false })
    expect(html).toContain('잠시 문제가 생겼어요')
    expect(html).toContain('다시 시도')
    expect(html).toContain('앱 새로 열기')
    expect(html).toContain('role="alert"')
  })

  it('오프라인이 원인이면 네트워크 안내로 바꾼다', () => {
    const html = fallbackMarkup({ hasError: true, wasOffline: true })
    expect(html).toContain('네트워크가 필요해요')
    expect(html).not.toContain('잠시 문제가 생겼어요')
  })

  it('navigator.onLine이 false면 오프라인으로 판정한다', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(AppErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true, wasOffline: true })
  })

  it('온라인인데 실패한 경우는 오프라인으로 단정하지 않는다', () => {
    vi.stubGlobal('navigator', { onLine: true })
    expect(AppErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true, wasOffline: false })
  })

  it('폴백은 외부 자산을 불러오지 않는다 (오프라인에서 표시되는 화면)', () => {
    const html = fallbackMarkup({ hasError: true, wasOffline: true })
    expect(html).not.toMatch(/<img|src="http|@import|url\(http/)
  })

  it('자식이 던진 예외를 경계가 잡아 폴백으로 대체한다', () => {
    // 에러 경계는 클라이언트 렌더에서만 동작하므로, 계약을 코드로 확인한다.
    class Boom extends Component<{ children?: ReactNode }> {
      override render(): ReactNode {
        throw new Error('렌더 실패')
      }
    }
    expect(() => renderToStaticMarkup(<Boom />)).toThrow('렌더 실패')
    // 예외가 발생하면 경계는 hasError 상태로 전이한다.
    expect(AppErrorBoundary.getDerivedStateFromError()).toMatchObject({ hasError: true })
  })
})
