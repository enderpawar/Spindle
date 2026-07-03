import type { CSSProperties, ReactNode } from 'react'

export function ScreenFrame({ background, children }: { background: string; children: ReactNode }) {
  const style: CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: 480,
    minHeight: '100svh',
    overflow: 'hidden',
    background,
  }
  return <div style={style}>{children}</div>
}
