export function IconHome({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      <path d="M12 3 L21 11 h-2 v9 h-5 v-6 h-4 v6 H3 v-9 H1 Z" />
    </svg>
  )
}

export function IconSpot({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M12 21 C8 17 4 13 4 9 a4 4 0 0 1 8-1 a4 4 0 0 1 8 1 c0 4-4 8-8 12z" />
    </svg>
  )
}

export function IconSpin({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9 L10 14 L13 11 Z" fill={color} />
    </svg>
  )
}

export function IconStamp({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 3 L14.5 9 L21 9.5 L16 13.5 L17.5 20 L12 16.5 L6.5 20 L8 13.5 L3 9.5 L9.5 9 Z" />
    </svg>
  )
}

export function IconCheckCircle({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12 l3 3 5-6" />
    </svg>
  )
}

export function IconShare({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.2 10.8 L15.8 7.2 M8.2 13.2 L15.8 16.8" />
    </svg>
  )
}
