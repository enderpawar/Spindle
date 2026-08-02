import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { HomeSpinContext, type HomeSpinContextProps } from './HomeSpinContext'

const departure = {
  id: 'busan-station',
  name: '부산역',
  desc: '부산 원도심의 관문',
  lat: 35.115,
  lon: 129.041,
}

function render(overrides: Partial<HomeSpinContextProps> = {}): string {
  return renderToStaticMarkup(
    <HomeSpinContext
      departure={departure}
      dial={40}
      candidateCount={null}
      festivalOngoingCount={null}
      onStartSpin={vi.fn()}
      onOpenFestival={vi.fn()}
      {...overrides}
    />,
  )
}

describe('HomeSpinContext SSR', () => {
  it('renders the cold state without count-dependent copy', () => {
    const markup = render()

    expect(markup).toContain('부산역 출발 · 이동 40분')
    expect(markup).not.toContain('현재 이동시간 안에 후보')
    expect(markup).not.toContain('이동시간을 넓혀 추천해요')
    expect(markup).not.toContain('축제 ')
  })

  it('renders a positive candidate count with the exact copy', () => {
    const markup = render({ candidateCount: 7 })

    expect(markup).toContain('현재 이동시간 안에 후보 7곳이 있어요')
    expect(markup).toContain('class="home-spin-candidate" aria-live="polite"')
  })

  it('renders the widening copy for a zero candidate count', () => {
    const markup = render({ candidateCount: 0 })

    expect(markup).toContain('이동시간을 넓혀 추천해요')
    expect(markup).not.toContain('후보 0곳')
  })

  it('renders the festival row only for a positive ongoing count', () => {
    const positive = render({ festivalOngoingCount: 2 })
    const zero = render({ festivalOngoingCount: 0 })
    const missing = render({ festivalOngoingCount: null })

    expect(positive).toContain('지금 원도심·영도에서 축제 2건이 열리고 있어요')
    expect(positive).toMatch(/<button[^>]*class="home-spin-festival"/)
    expect(zero).not.toContain('지금 원도심·영도에서 축제')
    expect(missing).not.toContain('지금 원도심·영도에서 축제')
  })

  it('renders exact CTA and quick action copy with accessible labels', () => {
    const markup = render()

    expect(markup).toContain('이 조건으로 돌리기')
    expect(markup).toContain('aria-label="20분으로 스핀 준비"')
    expect(markup).toContain('aria-label="40분으로 스핀 준비"')
    expect(markup).toMatch(/>20분<\/button>/)
    expect(markup).toMatch(/>40분<\/button>/)
    expect(markup).not.toContain('aria-pressed')
  })

  it('uses an h2 referenced by the section aria-labelledby', () => {
    const markup = render()

    expect(markup).toContain('<section class="home-spin-context" aria-labelledby="home-spin-context-title">')
    expect(markup).toContain('<h2 id="home-spin-context-title">오늘의 스핀 조건</h2>')
  })

  it('keeps the home h1 and existing source line after the context section', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
    })
    const { HomeScreen } = await import('../screens/HomeScreen')
    const markup = renderToStaticMarkup(
      <HomeScreen
        departure={departure}
        dial={40}
        candidateCount={null}
        festivalOngoingCount={null}
        onStartSpin={vi.fn()}
        onOpenDeparture={vi.fn()}
        onOpenTheme={vi.fn()}
        onOpenFestival={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )

    expect(markup).toContain('<h1 class="home-hero-title">숨은 부산을<br/>발견하세요</h1>')
    expect(markup.match(/출처: ⓒ한국관광공사/g)).toHaveLength(1)
    expect(markup.indexOf('home-spin-context')).toBeLessThan(markup.indexOf('출처: ⓒ한국관광공사'))
  })
})
