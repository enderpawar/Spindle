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
import { fetchAllOldTownPois, toEnginePoi } from "../api/tourapi";
import { SECTORS, SECTOR_KO, normalizeHeading } from "../engine/compass";
import { ORIGIN_PRESETS, type OriginPreset } from "../engine/origins";
import {
  DIAL_LIMIT_MIN,
  recommend,
  type Dial,
  type EnginePoi,
  type RankedCandidate,
  type RecommendResult,
} from "../engine/recommend";
import { DEMO_POIS } from "./demoPois";

const NAVY = "#0F2540";
const ORANGE = "#FF7A45";
const DIAL_LABEL: Record<Dial, string> = { light: "가볍게", half: "반나절", day: "하루 나들이" };

type PoisState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; pois: readonly EnginePoi[]; demo: boolean };

type Screen = "home" | "origin" | "reveal" | "result";

const isDemo = new URLSearchParams(window.location.search).get("demo") === "1";

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

/** 나침반 로즈 원판 — rotation(도)만큼 원판이 돌고, 상단 고정 마커가 방위를 가리킨다 */
function CompassRose({ rotation, onSpinEnd }: { rotation: number; onSpinEnd: () => void }) {
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
          transition: "transform 2.6s cubic-bezier(0.15, 0.85, 0.25, 1)",
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

function App() {
  const [poisState, retryPois] = usePois();
  const [screen, setScreen] = useState<Screen>("home");
  const [origin, setOrigin] = useState<OriginPreset>(ORIGIN_PRESETS[0]);
  const [dial, setDial] = useState<Dial>("half"); // ui.md: 기본 반나절
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [candIndex, setCandIndex] = useState(0);
  const prevContentId = useRef<string | undefined>(undefined);
  const pendingHeading = useRef<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poisReady = poisState.status === "ready";

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
    const rec = recommend({
      origin: origin.point,
      heading,
      dial,
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

  function skipReveal() {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    setScreen("result");
  }

  const candidates: RankedCandidate[] = result?.picked
    ? [result.picked, ...result.alternates]
    : [];
  const current = candidates.length > 0 ? candidates[candIndex % candidates.length] : null;

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
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span
                style={{
                  fontSize: 13,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.3)",
                }}
              >
                여행 모드
              </span>
              <button
                style={{ ...button, minHeight: 44, padding: "8px 14px", fontSize: 14 }}
                onClick={() => setScreen("origin")}
              >
                출발점: {origin.name} ▾
              </button>
            </header>

            <CompassRose rotation={rotation} onSpinEnd={onSpinEnd} />

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

            <button
              style={{ ...primaryButton, width: "100%", fontSize: 18, opacity: poisReady && !spinning ? 1 : 0.55 }}
              disabled={!poisReady || spinning}
              onClick={spin}
            >
              {spinning ? "도는 중…" : "돌리기"}
            </button>
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
              {origin.name} · {DIAL_LABEL[dial]} · {result.sectorKo}쪽
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
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 16,
                  padding: 20,
                  margin: "12px 0 16px",
                }}
              >
                {current.tier === "T3" && (
                  <span
                    style={{
                      fontSize: 12,
                      background: ORANGE,
                      color: "#1A1208",
                      borderRadius: 999,
                      padding: "3px 10px",
                      fontWeight: 700,
                    }}
                  >
                    숨은 명소
                  </span>
                )}
                <h1 style={{ fontSize: 24, margin: "8px 0" }}>{current.poi.title}</h1>
                <p style={{ fontSize: 15, opacity: 0.85, margin: 0 }}>{travelLabel(current)}</p>
                {candidates.length > 1 && (
                  <p style={{ fontSize: 12, opacity: 0.55, marginTop: 8 }}>
                    후보 {(candIndex % candidates.length) + 1} / {candidates.length}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ padding: "32px 0", textAlign: "center" }}>
                <p style={{ fontSize: 17 }}>이 조건에 맞는 곳을 찾지 못했어요</p>
                <p style={{ fontSize: 14, opacity: 0.75 }}>이동시간을 넓히거나 다시 돌려 보세요</p>
              </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              {candidates.length > 1 && (
                <button style={button} onClick={() => setCandIndex((i) => i + 1)}>
                  다른 후보 보기
                </button>
              )}
              <button style={primaryButton} onClick={() => setScreen("home")}>
                다시 돌리기
              </button>
            </div>
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
