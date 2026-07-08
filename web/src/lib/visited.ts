/**
 * 방문한 POI 기록 — 도장깨기(Phase 7). 단말 localStorage에만 저장한다.
 *
 * 규정 준수 (AGENTS.md 절대 원칙):
 * - 저장 대상은 사용자의 방문 기록(POI id)뿐이다. TourAPI 응답은 저장하지 않는다 (원칙 3).
 * - 어떤 서버로도 전송하지 않는다 — 좌표·식별자·방위각 무전송 (원칙 1). 전부 단말 내.
 */
import { useSyncExternalStore } from 'react'

const KEY = 'spindle.visited.v1'

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set() // 프라이빗 모드·localStorage 미지원 등 — 조용히 빈 집합
  }
}

// getSnapshot이 안정적인 참조를 반환하도록, 변경이 있을 때만 새 Set으로 교체한다.
let snapshot: Set<string> = read()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function persist(next: Set<string>): void {
  snapshot = next
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    // 저장 실패해도 세션 내 상태(snapshot)는 유지한다.
  }
  emit()
}

export function getVisited(): Set<string> {
  return snapshot
}

export function isVisited(id: string): boolean {
  return snapshot.has(id)
}

/** 방문 기록 추가. 새로 추가되면 true, 이미 있으면 false (도장 획득 연출 트리거용). */
export function markVisited(id: string): boolean {
  if (snapshot.has(id)) return false
  const next = new Set(snapshot)
  next.add(id)
  persist(next)
  return true
}

export function unmarkVisited(id: string): void {
  if (!snapshot.has(id)) return
  const next = new Set(snapshot)
  next.delete(id)
  persist(next)
}

/** 전체 초기화 (설정 화면 등에서 사용). */
export function resetVisited(): void {
  if (snapshot.size === 0) return
  persist(new Set())
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

// 다른 탭에서의 변경 동기화
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KEY) {
      snapshot = read()
      emit()
    }
  })
}

/** React 구독 — 방문 집합이 바뀌면 리렌더. */
export function useVisited(): Set<string> {
  return useSyncExternalStore(subscribe, getVisited, getVisited)
}
