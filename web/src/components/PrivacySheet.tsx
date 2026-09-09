import { useEffect, useRef } from 'react'
import { useBackGuard } from '../navigation/useBackGuard'
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_SECTIONS,
  PRIVACY_TITLE,
  type PrivacyBlock,
} from '../content/privacyPolicy'

function Block({ block }: { block: PrivacyBlock }) {
  if (block.kind === 'list') {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item.lead ?? item.text}>
            {item.lead && <strong>{item.lead} </strong>}
            {item.text}
          </li>
        ))}
      </ul>
    )
  }
  if (block.kind === 'contact') {
    return (
      <p>
        {block.label}: <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>
      </p>
    )
  }
  return <p>{block.text}</p>
}

/**
 * 설정 › 개인정보처리방침을 앱 안에서 읽는 하단 시트.
 *
 * 예전에는 `/privacy.html`을 새 탭으로 열어 앱을 벗어났다. 스토어 심사 요건은
 * "앱 안에서 열람 가능"이므로 이탈 없이 시트로 보여주고, `public/privacy.html`은
 * 스토어에 등록된 공개 URL(`/privacy`)로 그대로 남긴다.
 * 본문 원본은 `src/content/privacyPolicy.ts` 하나다.
 */
export function PrivacySheet({ onClose }: { onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)

  // 시트가 떠 있으면 하드웨어 뒤로가기는 화면을 옮기지 않고 이것부터 닫는다 (docs/ui.md 뒤로가기 규칙).
  useBackGuard(true, onClose)

  useEffect(() => {
    closeButton.current?.focus()
  }, [])

  return (
    <div
      className="motion-overlay"
      // 하단 내비(BottomNav zIndex 20)보다 위여야 한다 — 아래면 8절이 내비 뒤로 잘린다.
      style={{ position: 'absolute', inset: 0, zIndex: 30 }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onClose()
      }}
    >
      <button
        aria-label="닫기"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(12,26,54,.45)', cursor: 'pointer' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-sheet-title"
        className="motion-sheet no-scrollbar"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82%', overflowY: 'auto', background: '#fff', borderRadius: '24px 24px 0 0', padding: '22px 20px calc(28px + env(safe-area-inset-bottom))', boxShadow: '0 -12px 40px rgba(20,40,90,.22)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div id="privacy-sheet-title" style={{ fontSize: 21, lineHeight: 1.25, fontWeight: 800, color: 'var(--l-ink)' }}>
              {PRIVACY_TITLE}
            </div>
            <div style={{ marginTop: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--l-ink-3)' }}>
              시행일자: {PRIVACY_EFFECTIVE_DATE}
            </div>
          </div>
          <button ref={closeButton} onClick={onClose} aria-label="닫기" className="l-icon-btn" style={{ flex: 'none' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--l-ink)" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
              <path d="M6 6 l12 12 M18 6 L6 18" />
            </svg>
          </button>
        </div>

        <div className="privacy-sheet-body">
          {PRIVACY_SECTIONS.map((section) => (
            <section key={section.id} aria-labelledby={`privacy-${section.id}`}>
              <h3 id={`privacy-${section.id}`}>{section.heading}</h3>
              {section.blocks.map((block, index) => (
                <Block key={`${section.id}-${index}`} block={block} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
