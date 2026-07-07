/**
 * Phase 1 검증 전용 페이지 (/poi-check.html)
 * "4개 구 POI 목록이 프록시 경유로 화면에 렌더링" DoD를 확인하는 용도로,
 * 본 앱 화면(docs/ui.md)과는 무관하다. 실행: `npm run dev:proxy` + `npm run dev`.
 */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { OLD_TOWN_REGIONS, type SigunguRegion } from "../api/regionCodes";
import { fetchAreaPoisCached, type AreaPoi } from "../api/tourapi";

type RegionState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; pois: AreaPoi[] };

function RegionSection({ region }: { region: SigunguRegion }) {
  const [state, setState] = useState<RegionState>({ status: "loading" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchAreaPoisCached(region.code)
      .then((pois) => !cancelled && setState({ status: "done", pois }))
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [region.code, retryKey]);

  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18 }}>
        {region.name} <small>(sigunguCode={region.code})</small>{" "}
        {state.status === "done" && <span>— {state.pois.length}곳</span>}
      </h2>
      {state.status === "loading" && <p>불러오는 중…</p>}
      {state.status === "error" && (
        <p style={{ color: "crimson" }}>
          오류: {state.message}{" "}
          <button onClick={() => setRetryKey((k) => k + 1)}>재시도</button>
        </p>
      )}
      {state.status === "done" && (
        <ol style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #ccc", padding: "8px 8px 8px 32px" }}>
          {state.pois.map((p) => (
            <li key={p.contentid}>
              {p.title} <small>({p.addr1 || "주소 없음"})</small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function PoiCheckPage() {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>Spindle POI 연동 점검 (Phase 1)</h1>
      <p>
        원도심·영도 4개 구의 <code>areaBasedList2</code> 목록을 프록시(<code>/api</code>) 경유로
        실시간 조회한다. 데이터 출처: TourAPI.
      </p>
      {OLD_TOWN_REGIONS.map((region) => (
        <RegionSection key={region.code} region={region} />
      ))}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PoiCheckPage />
  </StrictMode>,
);
