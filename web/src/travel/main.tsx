/**
 * Phase 2 여행 모드 흐름 (S1 홈/스핀 → S2 출발점 → S3 방위 연출 → S4 결과 텍스트).
 * docs/ui.md 명세 기준 — 결과 "카드"는 Phase 3에서 완성하므로 여기서는 텍스트 수준.
 * 본 앱 엔트리(App.tsx)와 분리된 검증용 엔트리이며, 통합은 해당 화면 작업 커밋 후 진행.
 *
 * ⚠(ui.md 미확정 제안값 사용): 딥 네이비 #0F2540 + 선셋 오렌지 #FF7A45, Pretendard.
 */
import { StrictMode, useEffect, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import { fetchPoiDetailCached, firstSentence, stripHtml, type PoiDetail } from "../api/details";
import { fetchAllOldTownPois, toEnginePoi } from "../api/tourapi";
import { SECTORS, SECTOR_KO, normalizeHeading, sectorOf, type Sector } from "../engine/compass";
import type { GeoPoint } from "../engine/geo";
import { HeadingSmoother } from "../engine/heading";
import { parseOperationStatus } from "../engine/operation";
import { ORIGIN_PRESETS, type OriginPreset } from "../engine/origins";
import {
  DIAL_LIMIT_MIN,
  recommend,
  type Dial,
  type EnginePoi,
  type RankedCandidate,
  type RecommendResult,
} from "../engine/recommend";
import { GeoFixError, getCurrentFix, type GeoErrorKind } from "../sensors/geolocation";
import {
  isOrientationSupported,
  requestOrientationPermission,
  subscribeHeading,
} from "../sensors/orientation";
import { DEMO_POIS } from "./demoPois";

const NAVY = "#0F2540";
const ORANGE = "#FF7A45";
const DIAL_LABEL: Record<Dial, string> = { light: "가볍게", half: "반나절", day: "하루 나들이" };

/**
 * ⚠ ui.md 미확정 제안값 — 방위별 보조 색상 8종 (밤바다 네이비 위 대비 확보).
 * S4 카드의 이미지 폴백 배경·연출에 사용. 확정 시 ui.md 디자인 톤 절과 함께 갱신.
 */
const SECTOR_COLOR: Record<Sector, string> = {
  N: "#5C7CFA", // 북 — 심야 블루
  NE: "#4DABF7", // 북동 — 새벽 하늘
  E: "#22B8CF", // 동 — 떠오르는 청록
  SE: "#20C997", // 남동 — 아침 물빛
  S: "#FFA94D", // 남 — 한낮 볕
  SW: "#FF7A45", // 남서 — 선셋 오렌지(테마 포인트)
  W: "#FA5252", // 서 — 노을
  NW: "#9775FA", // 북서 — 땅거미 보라
};

/** 길찾기 딥링크 — 좌표 대신 이름 검색으로 카카오맵·네이버지도에 위임 (자체 경로계산 없음) */
function mapLinks(title: string): { kakao: string; naver: string } {
  const q = encodeURIComponent(`부산 ${title}`);
  return {
    kakao: `https://map.kakao.com/link/search/${q}`,
    naver: `https://map.naver.com/p/search/${q}`,
  };
}

/** 운영상태 표시 — 파싱 성공 시 "오늘 영업/휴무", 실패 시 원문 그대로 (ui.md S4·algorithm 스킬) */
function operationLabel(
  detail: PoiDetail,
  now: Date,
): { text: string; known: boolean } | null {
  const status = parseOperationStatus(detail.restdate, now);
  if (status.kind === "open") return { text: "오늘 영업", known: true };
  if (status.kind === "closed") return { text: "오늘 휴무", known: true };
  if (status.raw) return { text: status.raw, known: false }; // 판정 불가 → 원문 노출
  return null;
}

type PoisState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; pois: readonly EnginePoi[]; demo: boolean };

type Screen = "home" | "origin" | "reveal" | "result";

const isDemo = new URLSearchParams(window.location.search).get("demo") === "1";

type Mode = "travel" | "field";

type FieldPhase =
  | { status: "prompt" } // 권한 요청 전 CTA
  | { status: "acquiring" } // 권한·GPS 취득 중
  | { status: "tracking"; origin: GeoPoint } // 라이브 나침반 추종
  | { status: "error"; message: string; detail: string; retryable: boolean };

/** 현장 모드 가능 환경인가 — DeviceOrientation + Geolocation 둘 다 필요 (데스크톱은 폴백) */
function isFieldModeAvailable(): boolean {
  return isOrientationSupported() && typeof navigator !== "undefined" && Boolean(navigator.geolocation);
}

/** GPS 실패 종류 → 사용자 문구 (좌표·내부 오류 메시지는 노출하지 않음) */
function geoErrorTitle(kind: GeoErrorKind): string {
  switch (kind) {
    case "denied":
      return "위치 권한이 필요해요";
    case "timeout":
      return "위치를 확인하지 못했어요 (시간 초과)";
    case "unsupported":
      return "이 기기는 위치를 지원하지 않아요";
    default:
      return "위치를 확인하지 못했어요";
  }
}

/** 원판 회전을 목표 각도로 최단 경로(±180° 내)로 갱신 — 0/360 wrap 시 역회전 방지 */
function nextRotation(prev: number, targetDeg: number): number {
  const cur = ((prev % 360) + 360) % 360;
  let delta = (targetDeg - cur) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return prev + delta;
}

/** 방위가 이 시간(ms) 이상 안정되면 잠근다 (현장 모드 자동 정지) */
const FIELD_LOCK_MS = 1100;

function usePois(): [PoisState, () => void] {
  const [state, setState] = useState<PoisState>({ status: "loading" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (isDemo) {
      setState({ status: "ready", pois: DEMO_POIS, demo: true });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetchAllOldTownPois()
      .then((byRegion) => {
        if (cancelled) return;
        const pois = byRegion
          .flatMap(({ pois: regionPois }) => regionPois)
          .map(toEnginePoi)
          .filter((p): p is EnginePoi => p !== null);
        setState({ status: "ready", pois, demo: false });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  return [state, () => setRetryKey((k) => k + 1)];
}

/**
 * 나침반 로즈 원판 — rotation(도)만큼 원판이 돌고, 상단 고정 마커가 방위를 가리킨다.
 * 여행 모드는 긴 자동 스핀(기본 2600ms) + onSpinEnd로 정지 방위를 산출하고,
 * 현장 모드는 짧은 transition으로 기기 방위각을 실시간 추종한다(onSpinEnd 미사용).
 */
function CompassRose({
  rotation,
  transitionMs = 2600,
  onSpinEnd,
}: {
  rotation: number;
  transitionMs?: number;
  onSpinEnd?: () => void;
}) {
  return (
    <div style={{ position: "relative", width: 280, height: 280, margin: "0 auto" }}>
      <div
        style={{
          position: "absolute",
          top: -6,
          left: "50%",
          transform: "translateX(-50%)",
          color: ORANGE,
          fontSize: 22,
          lineHeight: 1,
          zIndex: 1,
        }}
        aria-hidden
      >
        ▼
      </div>
      <svg
        viewBox="-140 -140 280 280"
        width={280}
        height={280}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: `transform ${transitionMs}ms cubic-bezier(0.15, 0.85, 0.25, 1)`,
        }}
        onTransitionEnd={onSpinEnd}
        role="img"
        aria-label="나침반 원판"
      >
        <circle r="132" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.35)" />
        <circle r="4" fill={ORANGE} />
        {SECTORS.map((sector, i) => {
          const angle = i * 45;
          const rad = ((angle - 90) * Math.PI) / 180;
          const labelR = 108;
          return (
            <g key={sector}>
              <line
                x1={Math.cos(rad) * 120}
                y1={Math.sin(rad) * 120}
                x2={Math.cos(rad) * 130}
                y2={Math.sin(rad) * 130}
                stroke={i === 0 ? ORANGE : "rgba(255,255,255,0.5)"}
                strokeWidth={i % 2 === 0 ? 3 : 1.5}
              />
              <text
                x={Math.cos(rad) * labelR}
                y={Math.sin(rad) * labelR}
                fill={i === 0 ? ORANGE : "rgba(255,255,255,0.85)"}
                fontSize={i % 2 === 0 ? 17 : 13}
                textAnchor="middle"
                dominantBaseline="central"
               
              >
                {SECTOR_KO[sector]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function travelLabel(c: RankedCandidate): string {
  const minutes = Math.max(1, Math.round(c.travel.minutes));
  switch (c.travel.method) {
    case "walk":
    case "bridge":
      return `걸어서 약 ${minutes}분`;
    case "transit":
      return `대중교통 포함 약 ${minutes}분`;
    case "estimate":
      return `약 ${minutes}분 (직선 근사 · 하루 나들이)`;
  }
}

type DetailState =
  | { status: "skip" } // 데모 모드 등 상세 호출을 하지 않는 경우
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; detail: PoiDetail };

/** 결과 시점에 contentId 상세를 조회 (details.ts 세션 캐시 경유). demo 모드면 skip. */
function useDetail(contentId: string | undefined, enabled: boolean): [DetailState, () => void] {
  const [state, setState] = useState<DetailState>({ status: "skip" });
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    if (!enabled || !contentId) {
      setState({ status: "skip" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetchPoiDetailCached(contentId)
      .then((detail) => {
        if (!cancelled) setState({ status: "ready", detail });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [contentId, enabled, retryKey]);
  return [state, () => setRetryKey((k) => k + 1)];
}

/** 대표 이미지 없음/로드 실패 → 방위 색상 배경 + 나침반 아이콘 (ui.md S4 폴백) */
function FallbackImage({ color }: { color: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(140deg, ${color}, ${NAVY})`,
        display: "grid",
        placeItems: "center",
      }}
      aria-hidden
    >
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.4}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 5 L14 12 L12 19 L10 12 Z" fill="rgba(255,255,255,0.85)" stroke="none" />
        <circle cx="12" cy="12" r="1.3" fill="rgba(255,255,255,0.85)" stroke="none" />
      </svg>
    </div>
  );
}

/** 대표 이미지 — URL 있으면 표시, 로드 실패 시 폴백으로 대체 (key로 POI별 상태 초기화) */
function PoiImage({ url, color, title }: { url: string | undefined; color: string; title: string }) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(url) && !errored;
  return (
    <div style={{ position: "relative", height: 200, borderRadius: 16, overflow: "hidden", background: NAVY }}>
      {showImage ? (
        <img
          src={url}
          alt={title}
          onError={() => setErrored(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <FallbackImage color={color} />
      )}
    </div>
  );
}

function SkeletonBar({ width, height = 14 }: { width: string | number; height?: number }) {
  return (
    <div
      style={{ width, height, borderRadius: 6, background: "rgba(255,255,255,0.1)" }}
      aria-hidden
    />
  );
}

/** 길찾기 앱 선택 시트 (카카오맵·네이버지도 딥링크) */
function NavSheet({ title, onClose }: { title: string; onClose: () => void }) {
  const links = mapLinks(title);
  const link: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 54,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.1)",
    background: "#fff",
    color: "#1A1208",
    fontSize: 16,
    fontWeight: 600,
    textDecoration: "none",
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 20 }}>
      <button
        aria-label="닫기"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          background: "rgba(6,15,32,0.55)",
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          margin: "0 auto",
          maxWidth: 480,
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "20px 20px calc(24px + env(safe-area-inset-bottom))",
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 800, color: "#101828", margin: "0 0 14px" }}>
          어떤 지도로 안내할까요?
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <a href={links.kakao} target="_blank" rel="noreferrer" style={link}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "#FFE812", color: "#3d2c00", display: "grid", placeItems: "center", fontWeight: 900 }}>K</span>
            카카오맵으로 길찾기
          </a>
          <a href={links.naver} target="_blank" rel="noreferrer" style={link}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "#2DB400", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900 }}>N</span>
            네이버지도로 길찾기
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [poisState, retryPois] = usePois();
  const [screen, setScreen] = useState<Screen>("home");
  const [origin, setOrigin] = useState<OriginPreset>(ORIGIN_PRESETS[0]);
  const [dial, setDial] = useState<Dial>("half"); // ui.md: 기본 반나절
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [candIndex, setCandIndex] = useState(0);
  const [navSheet, setNavSheet] = useState(false);
  const [mode, setMode] = useState<Mode>("travel"); // 기본 여행 모드 (심사 시연 경로)
  const [fieldPhase, setFieldPhase] = useState<FieldPhase>({ status: "prompt" });
  const [liveHeading, setLiveHeading] = useState(0); // 현장 모드 스무딩된 방위각
  const [fieldRotation, setFieldRotation] = useState(0); // 라이브 원판 회전(연속값)
  const prevContentId = useRef<string | undefined>(undefined);
  const pendingHeading = useRef<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false); // 현장 모드 방위 잠금 1회 보장

  const poisReady = poisState.status === "ready";

  // 비동기 센서 콜백에서 최신 dial 값을 읽기 위한 ref (스테일 클로저 방지)
  const dialRef = useRef(dial);
  dialRef.current = dial;

  /** 스핀/방위 잠금 공통 — 추천 실행 후 연출(S3) → 결과(S4)로 전환 */
  function runRecommend(originPoint: GeoPoint, heading: number) {
    if (poisState.status !== "ready") return;
    const rec = recommend({
      origin: originPoint,
      heading,
      dial: dialRef.current,
      pois: poisState.pois,
      rng: Math.random,
      prevContentId: prevContentId.current,
    });
    prevContentId.current = rec.picked?.poi.contentId ?? prevContentId.current;
    setResult(rec);
    setCandIndex(0);
    setScreen("reveal");
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setScreen("result"), 2200); // S3: ~2초 후 자동 전환
  }

  // 센서 tracking effect에서 스테일 없이 최신 runRecommend를 호출하기 위한 ref
  const runRecommendRef = useRef(runRecommend);
  runRecommendRef.current = runRecommend;

  function spin() {
    if (!poisReady || spinning) return;
    // 연출 각도 = 알고리즘 입력 각도 (sensors 스킬): heading을 먼저 확정하고
    // 원판 회전량을 heading에서 역산한다. 상단 마커 기준 heading = (360 - rotation) mod 360.
    const heading = normalizeHeading(Math.random() * 360);
    pendingHeading.current = heading;
    const base = rotation - (rotation % 360);
    setRotation(base + 3 * 360 + (360 - heading));
    setSpinning(true);
  }

  function onSpinEnd() {
    if (!spinning || pendingHeading.current === null || poisState.status !== "ready") return;
    const heading = pendingHeading.current;
    pendingHeading.current = null;
    setSpinning(false);
    runRecommend(origin.point, heading); // 여행 모드: 프리셋 출발점 + 자동 스핀 방위
  }

  function skipReveal() {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    setScreen("result");
  }

  // ── 현장 모드 (센서) ──────────────────────────────────────────────
  function selectMode(next: Mode) {
    setMode(next);
    if (next !== "field") return;
    // 데스크톱 등 센서 미지원 → 즉시 폴백 안내 (여행 모드로 유도)
    if (!isFieldModeAvailable()) {
      setFieldPhase({
        status: "error",
        message: "이 기기는 위치·나침반 센서를 지원하지 않아요",
        detail: "데스크톱 등 센서가 없는 환경이에요. 여행 모드로 방향을 정할 수 있어요.",
        retryable: false,
      });
    } else {
      setFieldPhase({ status: "prompt" });
    }
  }

  /** 사용자 제스처 안에서 방위 권한 요청 + GPS 1회 취득 → 라이브 추종 시작 */
  async function startField() {
    if (!poisReady) return;
    setFieldPhase({ status: "acquiring" });
    const perm = await requestOrientationPermission(); // 반드시 제스처 핸들러 내부 (sensors 스킬)
    if (perm !== "granted") {
      setFieldPhase({
        status: "error",
        message: perm === "unsupported" ? "이 기기는 나침반을 지원하지 않아요" : "나침반 권한이 필요해요",
        detail: "권한을 허용하거나, 여행 모드로 계속할 수 있어요.",
        retryable: perm !== "unsupported",
      });
      return;
    }
    try {
      const origin = await getCurrentFix(); // 좌표는 단말 내 존 판정에만 사용 (무전송)
      lockedRef.current = false;
      setLiveHeading(0);
      setFieldRotation(0);
      setFieldPhase({ status: "tracking", origin });
    } catch (err) {
      const kind: GeoErrorKind = err instanceof GeoFixError ? err.kind : "unavailable";
      setFieldPhase({
        status: "error",
        message: geoErrorTitle(kind),
        detail: "여행 모드로 계속할 수 있어요.",
        retryable: kind !== "unsupported",
      });
    }
  }

  /** "이 방향으로 결정" — 현재 방위각을 즉시 잠근다 (자동 정지 대기 없이) */
  function manualLock() {
    if (fieldPhase.status !== "tracking" || lockedRef.current) return;
    lockedRef.current = true;
    runRecommend(fieldPhase.origin, liveHeading);
  }

  /** 결과 → 홈 복귀 (현장 모드면 잠금 해제 후 다시 추종 재개) */
  function backToSpin() {
    setNavSheet(false);
    lockedRef.current = false;
    setScreen("home");
  }

  // 라이브 나침반 추종 + 방위 안정 시 자동 잠금 (홈·현장·tracking일 때만 구독)
  useEffect(() => {
    if (mode !== "field" || screen !== "home" || fieldPhase.status !== "tracking") return;
    const origin = fieldPhase.origin;
    const smoother = new HeadingSmoother(8);
    let stableSince = 0;
    const unsubscribe = subscribeHeading((deg) => {
      smoother.push(deg);
      const value = smoother.value;
      if (value === null) return;
      setLiveHeading(value);
      setFieldRotation((prev) => nextRotation(prev, normalizeHeading(360 - value)));
      if (lockedRef.current) return;
      if (smoother.isStable()) {
        const now = performance.now();
        if (stableSince === 0) {
          stableSince = now;
        } else if (now - stableSince >= FIELD_LOCK_MS) {
          lockedRef.current = true;
          runRecommendRef.current(origin, value);
        }
      } else {
        stableSince = 0; // 다시 흔들리면 안정 타이머 초기화
      }
    });
    return unsubscribe;
  }, [mode, screen, fieldPhase]);

  const candidates: RankedCandidate[] = result?.picked
    ? [result.picked, ...result.alternates]
    : [];
  const current = candidates.length > 0 ? candidates[candIndex % candidates.length] : null;

  // 결과 시점 상세 조회 (details.ts). demo 모드는 네트워크 없이 폴백 카드로 동작.
  const enableDetail = poisState.status === "ready" && !poisState.demo;
  const [detailState, retryDetail] = useDetail(current?.poi.contentId, enableDetail);
  const detail = detailState.status === "ready" ? detailState.detail : null;
  const sectorColor = result ? SECTOR_COLOR[result.sector] : SECTOR_COLOR.N;
  const operation = detail ? operationLabel(detail, new Date()) : null;
  const intro = detail?.overview ? firstSentence(detail.overview) : null;
  const imageUrl = detail?.imageUrl;
  const originLabel = mode === "field" ? "내 위치" : origin.name;
  const liveSectorKo = SECTOR_KO[sectorOf(liveHeading)];

  const frame: CSSProperties = {
    minHeight: "100vh",
    background: NAVY,
    color: "#F4F6FB",
    fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
    display: "flex",
    justifyContent: "center",
  };
  const column: CSSProperties = {
    width: "100%",
    maxWidth: 480,
    padding: "20px 20px 40px",
    boxSizing: "border-box",
  };
  const button: CSSProperties = {
    minHeight: 48,
    padding: "12px 20px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    fontSize: 16,
    cursor: "pointer",
  };
  const primaryButton: CSSProperties = {
    ...button,
    background: ORANGE,
    border: "none",
    color: "#1A1208",
    fontWeight: 700,
  };

  // 이동시간 다이얼 — 여행·현장 모드 공용 (ui.md S1: 기본 반나절)
  const dialRow = (
    <div role="group" aria-label="이동시간 다이얼" style={{ display: "flex", gap: 8, margin: "24px 0 16px" }}>
      {(Object.keys(DIAL_LABEL) as Dial[]).map((d) => (
        <button
          key={d}
          onClick={() => setDial(d)}
          style={{
            ...button,
            flex: 1,
            fontSize: 14,
            background: d === dial ? ORANGE : button.background,
            color: d === dial ? "#1A1208" : "inherit",
            fontWeight: d === dial ? 700 : 400,
            border: d === dial ? "none" : button.border,
          }}
        >
          {DIAL_LABEL[d]}
          <span style={{ display: "block", fontSize: 11, opacity: 0.75 }}>
            {Number.isFinite(DIAL_LIMIT_MIN[d]) ? `~${DIAL_LIMIT_MIN[d]}분` : "제한 없음"}
          </span>
        </button>
      ))}
    </div>
  );

  // 목록 로딩·에러 안내 — 두 모드 공용 (빈 화면 금지)
  const poisStatusNote = (
    <>
      {poisState.status === "loading" && (
        <p style={{ textAlign: "center", opacity: 0.8 }}>주변 장소를 불러오는 중이에요…</p>
      )}
      {poisState.status === "error" && (
        <p style={{ textAlign: "center" }}>
          잠시 연결이 어려워요{" "}
          <button style={{ ...button, minHeight: 44, fontSize: 14 }} onClick={retryPois}>
            재시도
          </button>
        </p>
      )}
    </>
  );

  return (
    <div style={frame}>
      <div style={column}>
        {poisState.status === "ready" && poisState.demo && (
          <p
            style={{
              background: "rgba(255,122,69,0.15)",
              border: `1px solid ${ORANGE}`,
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            데모 데이터 모드 — TourAPI 미연동 검증용 합성 목록입니다
          </p>
        )}

        {screen === "home" && (
          <>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span
                style={{
                  fontSize: 13,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.3)",
                }}
              >
                {mode === "field" ? "현장 모드" : "여행 모드"}
              </span>
              {mode === "travel" && (
                <button
                  style={{ ...button, minHeight: 44, padding: "8px 14px", fontSize: 14 }}
                  onClick={() => setScreen("origin")}
                >
                  출발점: {origin.name} ▾
                </button>
              )}
            </header>

            {/* 모드 전환 — 여행(센서 불필요, 심사 시연) / 현장(GPS·나침반) */}
            <div role="group" aria-label="모드 선택" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {([["travel", "여행 모드"], ["field", "현장 모드"]] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => selectMode(m)}
                  style={{
                    ...button,
                    flex: 1,
                    fontSize: 14,
                    background: m === mode ? ORANGE : button.background,
                    color: m === mode ? "#1A1208" : "inherit",
                    fontWeight: m === mode ? 700 : 400,
                    border: m === mode ? "none" : button.border,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "travel" && (
              <>
                <CompassRose rotation={rotation} onSpinEnd={onSpinEnd} />
                {dialRow}
                {poisStatusNote}
                <button
                  style={{ ...primaryButton, width: "100%", fontSize: 18, opacity: poisReady && !spinning ? 1 : 0.55 }}
                  disabled={!poisReady || spinning}
                  onClick={spin}
                >
                  {spinning ? "도는 중…" : "돌리기"}
                </button>
              </>
            )}

            {mode === "field" && fieldPhase.status === "prompt" && (
              <>
                <CompassRose rotation={0} transitionMs={0} />
                {dialRow}
                {poisStatusNote}
                <button
                  style={{ ...primaryButton, width: "100%", fontSize: 18, opacity: poisReady ? 1 : 0.55 }}
                  disabled={!poisReady}
                  onClick={startField}
                >
                  내 위치에서 돌리기
                </button>
                <p style={{ fontSize: 13, opacity: 0.65, textAlign: "center", marginTop: 12 }}>
                  현재 위치와 나침반으로 방향을 정해요. 위치·방위는 기기 안에서만 쓰여요.
                </p>
              </>
            )}

            {mode === "field" && fieldPhase.status === "acquiring" && (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <CompassRose rotation={fieldRotation} transitionMs={0} />
                <p style={{ marginTop: 24, opacity: 0.85 }}>위치와 나침반을 준비하고 있어요…</p>
              </div>
            )}

            {mode === "field" && fieldPhase.status === "tracking" && (
              <>
                <CompassRose rotation={fieldRotation} transitionMs={120} />
                <p style={{ textAlign: "center", fontSize: 16, margin: "20px 0 4px" }}>
                  지금 향한 곳:{" "}
                  <b style={{ color: ORANGE, fontSize: 20 }}>{liveSectorKo}쪽</b>
                </p>
                <p style={{ fontSize: 13, opacity: 0.65, textAlign: "center", margin: 0 }}>
                  휴대폰을 돌려 방향을 맞춘 뒤 잠시 멈추면 자동으로 정해져요.
                </p>
                {dialRow}
                {poisStatusNote}
                <button
                  style={{ ...primaryButton, width: "100%", fontSize: 18, opacity: poisReady ? 1 : 0.55 }}
                  disabled={!poisReady}
                  onClick={manualLock}
                >
                  이 방향으로 결정
                </button>
              </>
            )}

            {mode === "field" && fieldPhase.status === "error" && (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <p style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>{fieldPhase.message}</p>
                <p style={{ fontSize: 14, opacity: 0.8, margin: "0 0 20px" }}>{fieldPhase.detail}</p>
                <div style={{ display: "grid", gap: 10 }}>
                  {fieldPhase.retryable && (
                    <button
                      style={{ ...button, opacity: poisReady ? 1 : 0.55 }}
                      disabled={!poisReady}
                      onClick={startField}
                    >
                      다시 시도
                    </button>
                  )}
                  <button
                    style={fieldPhase.retryable ? button : primaryButton}
                    onClick={() => selectMode("travel")}
                  >
                    여행 모드로 계속
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {screen === "origin" && (
          <>
            <h1 style={{ fontSize: 20, marginBottom: 16 }}>어디에서 출발하나요?</h1>
            <div style={{ display: "grid", gap: 12 }}>
              {ORIGIN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  style={{
                    ...button,
                    textAlign: "left",
                    fontSize: 17,
                    padding: "18px 20px",
                    border:
                      preset.id === origin.id ? `1.5px solid ${ORANGE}` : button.border,
                  }}
                  onClick={() => {
                    setOrigin(preset);
                    setScreen("home"); // ui.md S2: 선택 즉시 S1 복귀
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, opacity: 0.6, marginTop: 16 }}>지도에서 고르기는 준비 중이에요 (Phase 5)</p>
          </>
        )}

        {screen === "reveal" && result && (
          <div
            onClick={skipReveal}
            style={{ textAlign: "center", paddingTop: 120, cursor: "pointer", minHeight: "60vh" }}
          >
            <p style={{ fontSize: 15, opacity: 0.75, marginBottom: 8 }}>오늘의 방향은</p>
            <p style={{ fontSize: 48, fontWeight: 800, color: ORANGE, margin: 0 }}>
              {result.sectorKo}쪽
            </p>
            {/* 8방위 큐레이션 메시지는 Phase 5에서 작성 — 자리만 유지 */}
            {result.expansionReason && (
              <p style={{ fontSize: 15, marginTop: 20, opacity: 0.9 }}>{result.expansionReason}</p>
            )}
            <p style={{ fontSize: 12, opacity: 0.5, marginTop: 48 }}>탭하면 바로 결과로 넘어가요</p>
          </div>
        )}

        {screen === "result" && result && (
          <>
            <p style={{ fontSize: 14, opacity: 0.75 }}>
              {originLabel} · {DIAL_LABEL[dial]} · {result.sectorKo}쪽
            </p>
            {result.expansionReason && (
              <p
                style={{
                  fontSize: 14,
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                {result.expansionReason}
              </p>
            )}

            {current ? (
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 18,
                  overflow: "hidden",
                  margin: "12px 0 16px",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {detailState.status === "loading" ? (
                  <>
                    <div
                      style={{ height: 200, background: "rgba(255,255,255,0.06)" }}
                      aria-label="상세 정보를 불러오는 중"
                    />
                    <div style={{ padding: 18, display: "grid", gap: 12 }}>
                      <SkeletonBar width="58%" height={26} />
                      <SkeletonBar width="82%" />
                      <SkeletonBar width="46%" height={30} />
                    </div>
                  </>
                ) : (
                  <>
                    <PoiImage
                      key={current.poi.contentId}
                      url={imageUrl}
                      color={sectorColor}
                      title={current.poi.title}
                    />
                    <div style={{ padding: 18 }}>
                      {current.tier === "T3" && (
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: 12,
                            background: ORANGE,
                            color: "#1A1208",
                            borderRadius: 999,
                            padding: "3px 10px",
                            fontWeight: 700,
                            marginBottom: 8,
                          }}
                        >
                          숨은 명소
                        </span>
                      )}
                      <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>{current.poi.title}</h1>
                      {intro && (
                        <p style={{ fontSize: 14, opacity: 0.8, margin: "0 0 12px", lineHeight: 1.5 }}>
                          {intro}
                        </p>
                      )}

                      {/* 정보 행: 보정 도보시간 · 운영상태 (ui.md S4) */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 14, padding: "6px 12px", borderRadius: 10, background: "rgba(255,255,255,0.08)" }}>
                          {travelLabel(current)}
                        </span>
                        {operation && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 13,
                              padding: "6px 12px",
                              borderRadius: 10,
                              background: operation.known ? "rgba(46,204,113,0.16)" : "rgba(255,255,255,0.08)",
                              color: operation.known ? "#7BE8A8" : "inherit",
                            }}
                          >
                            {operation.known && (
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2ECC71" }} />
                            )}
                            {operation.text}
                          </span>
                        )}
                      </div>

                      {detail?.usetime && (
                        <p style={{ fontSize: 12, opacity: 0.6, margin: "10px 0 0" }}>
                          이용시간 {stripHtml(detail.usetime)}
                        </p>
                      )}

                      {detailState.status === "error" && (
                        <p style={{ fontSize: 13, opacity: 0.85, margin: "12px 0 0" }}>
                          상세 정보를 불러오지 못했어요{" "}
                          <button
                            style={{ ...button, minHeight: 36, padding: "6px 12px", fontSize: 13 }}
                            onClick={retryDetail}
                          >
                            재시도
                          </button>
                        </p>
                      )}

                      {candidates.length > 1 && (
                        <p style={{ fontSize: 12, opacity: 0.55, marginTop: 12 }}>
                          후보 {(candIndex % candidates.length) + 1} / {candidates.length}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ padding: "32px 0", textAlign: "center" }}>
                <p style={{ fontSize: 17 }}>이 조건에 맞는 곳을 찾지 못했어요</p>
                <p style={{ fontSize: 14, opacity: 0.75 }}>이동시간을 넓히거나 다시 돌려 보세요</p>
              </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              {current && (
                <button style={primaryButton} onClick={() => setNavSheet(true)}>
                  길찾기
                </button>
              )}
              {candidates.length > 1 && (
                <button
                  style={button}
                  onClick={() => {
                    setNavSheet(false);
                    setCandIndex((i) => i + 1);
                  }}
                >
                  다른 후보 보기
                </button>
              )}
              <button style={current ? button : primaryButton} onClick={backToSpin}>
                다시 돌리기
              </button>
              {current && (
                <button
                  style={{ ...button, opacity: 0.5, cursor: "not-allowed" }}
                  disabled
                  aria-disabled
                >
                  공유 카드 만들기{" "}
                  <span style={{ fontSize: 12, opacity: 0.8 }}>(준비 중 · Phase 5)</span>
                </button>
              )}
            </div>

            {navSheet && current && (
              <NavSheet title={current.poi.title} onClose={() => setNavSheet(false)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
