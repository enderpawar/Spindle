interface Props {
  district: string
}

/** 길찾기 시트를 가리지 않는 도장 획득 인라인 안내. */
export function StampNotice({ district }: Props) {
  return (
    <div
      className="fade-up"
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
        padding: '10px 12px',
        borderRadius: 14,
        background: '#eef4ff',
        color: 'var(--l-primary)',
      }}
    >
      <img src="/stamp-mark-512.png" alt="" aria-hidden style={{ width: 34, height: 34, objectFit: 'contain', flex: 'none' }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, lineHeight: 1.2, fontWeight: 800, color: 'var(--l-ink-3)' }}>새로운 도장</div>
        <div style={{ marginTop: 2, fontSize: 13, lineHeight: 1.3, fontWeight: 900, color: 'var(--l-ink)' }}>{district} 여행 도장을 받았어요</div>
      </div>
    </div>
  )
}
