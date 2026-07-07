/**
 * 8방위 분류 수학 — sensors 스킬 규약.
 * 45° 부채꼴, 북(N) = 337.5°–22.5° 중심 정렬. 0/360 경계는 원형 차이로 처리.
 * 스핀 연출의 최종 각도와 알고리즘 입력 방위각은 반드시 동일해야 한다.
 */

export const SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Sector = (typeof SECTORS)[number];

export const SECTOR_KO: Record<Sector, string> = {
  N: "북",
  NE: "북동",
  E: "동",
  SE: "남동",
  S: "남",
  SW: "남서",
  W: "서",
  NW: "북서",
};

/** 각도를 [0, 360) 범위로 정규화 */
export function normalizeHeading(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/** heading → 8방위 인덱스 (0=N … 7=NW) */
export function sectorIndexOf(heading: number): number {
  return Math.round(normalizeHeading(heading) / 45) % 8;
}

export function sectorOf(heading: number): Sector {
  return SECTORS[sectorIndexOf(heading)];
}

/** 방위 부채꼴 중심선 각도 (N=0, NE=45, …) */
export function sectorCenterDeg(sector: Sector): number {
  return SECTORS.indexOf(sector) * 45;
}

/** 두 각도의 원형 차이 (0–180) — 0/360 wrap 안전 */
export function circularDiffDeg(a: number, b: number): number {
  const d = Math.abs(normalizeHeading(a) - normalizeHeading(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * 방향 일치도 (algorithm 스킬 규약):
 * 허용 반각(halfWidth) 밖 = 0, 안 = 0.5 + 0.5 × (1 - Δ/halfWidth).
 * 기본 부채꼴은 halfWidth 22.5° — 경계에서도 0.5 보장.
 */
export function directionScore(
  poiBearing: number,
  sectorCenter: number,
  halfWidth: number = 22.5,
): number {
  const diff = circularDiffDeg(poiBearing, sectorCenter);
  if (diff > halfWidth) return 0;
  return 0.5 + 0.5 * (1 - diff / halfWidth);
}
