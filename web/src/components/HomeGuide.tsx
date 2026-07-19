import { useEffect, useState } from 'react'

interface GuideStep {
  target: string
  eyebrow: string
  title: string
  body: string
}

const STEPS: readonly GuideStep[] = [
  {
    target: '[data-guide="departure"]',
    eyebrow: '출발점',
    title: '부산에 없어도 미리 떠날 수 있어요',
    body: '여기를 눌러 부산역·남포동·영도 중 여행을 시작할 곳을 골라보세요.',
  },
  {
    target: '[data-guide="spin"]',
    eyebrow: '스핀',
    title: '방향에 맡기고 부산을 발견해요',
    body: '지금 스핀하기를 누른 뒤 원판을 돌리면, 멈춘 방향에서 갈 곳을 추천해요.',
  },
  {
    target: '[data-guide="themes"]',
    eyebrow: '테마',
    title: '취향이 있다면 테마부터 골라보세요',
    body: '바다·골목·역사·야간·먹거리 중 오늘 끌리는 분위기로 바로 둘러볼 수 있어요.',
  },
  {
    target: '[data-guide="stamps"]',
    eyebrow: '도장깨기',
    title: '길찾기를 열면 동네 도장이 채워져요',
    body: '추천 장소를 찾아갈수록 원도심 여행 도장이 하나씩 쌓여요.',
  },
]

interface TargetRect {
  left: number
  top: number
  width: number
  height: number
  frameHeight: number
}

export function HomeGuide({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(step.target)
    const frame = document.querySelector<HTMLElement>('.screen')
    if (!target || !frame) return

    const scrollRoot = target.closest<HTMLElement>('.home-scroll')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (scrollRoot) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' })

    const updateRect = () => {
      const targetBox = target.getBoundingClientRect()
      const frameBox = frame.getBoundingClientRect()
      const sidePadding = 8
      setTargetRect({
        left: Math.max(8, targetBox.left - frameBox.left - sidePadding),
        top: Math.max(8, targetBox.top - frameBox.top - sidePadding),
        width: Math.min(targetBox.width + sidePadding * 2, frameBox.width - 16),
        height: targetBox.height + sidePadding * 2,
        frameHeight: frameBox.height,
      })
    }

    updateRect()
    const settleTimer = window.setTimeout(updateRect, 380)
    window.addEventListener('resize', updateRect)
    scrollRoot?.addEventListener('scroll', updateRect, { passive: true })
    return () => {
      window.clearTimeout(settleTimer)
      window.removeEventListener('resize', updateRect)
      scrollRoot?.removeEventListener('scroll', updateRect)
    }
  }, [step])

  const panelAtTop = !last && targetRect
    ? targetRect.top + targetRect.height / 2 > targetRect.frameHeight * 0.48
    : false

  return (
    <div className="home-guide" role="dialog" aria-modal="true" aria-label="Spindle 화면 사용법">
      {!targetRect && <div className="home-guide-backdrop" />}
      {targetRect && (
        <div
          className="home-guide-spotlight"
          style={{ left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height }}
        />
      )}

      <section className={`home-guide-panel ${panelAtTop ? 'home-guide-panel--top' : 'home-guide-panel--bottom'}`} aria-live="polite">
        <div className="home-guide-panel-head">
          <span>{index + 1} / {STEPS.length}</span>
          <button type="button" onClick={onClose}>건너뛰기</button>
        </div>
        <div className="home-guide-copy" key={step.target}>
          <div className="home-guide-eyebrow">{step.eyebrow}</div>
          <h2>{step.title}</h2>
          <p>{step.body}</p>
        </div>

        <div className="home-guide-footer">
          <div className="home-guide-dots" aria-hidden>
            {STEPS.map((_, dotIndex) => <span key={dotIndex} className={dotIndex === index ? 'on' : ''} />)}
          </div>
          <div className="home-guide-actions">
            {index > 0 && <button type="button" className="home-guide-prev" onClick={() => setIndex((value) => value - 1)}>이전</button>}
            <button type="button" className="home-guide-next" onClick={() => (last ? onClose() : setIndex((value) => value + 1))}>
              {last ? '완료' : '다음'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
