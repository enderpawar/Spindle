import type { CSSProperties } from 'react'

export function SourceLine({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={{
        margin: '20px 0 0',
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: 1.45,
        color: 'var(--l-ink-3)',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      출처: ⓒ한국관광공사
    </div>
  )
}
