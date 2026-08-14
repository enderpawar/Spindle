import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

type RawNumber = number | null | undefined;

type PermissionCapableOrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};

type PermissionCapableMotionConstructor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<string>;
};

type WebKitOrientationFields = {
  webkitCompassHeading?: number | null;
  webkitCompassAccuracy?: number | null;
};

type OrientationReading = {
  alpha: RawNumber;
  beta: RawNumber;
  gamma: RawNumber;
  absolute: boolean | null | undefined;
  webkitCompassHeading: RawNumber;
  webkitCompassAccuracy: RawNumber;
  count: number;
  receivedAt: string;
  receivedAtMs: number;
};

type MotionReading = {
  x: RawNumber;
  y: RawNumber;
  z: RawNumber;
  count: number;
};

type GpsState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp: number;
    }
  | { status: "error"; code: number; message: string };

type HeadingCandidate = {
  value: number;
  receivedAtMs: number;
  source: string;
};

const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/**
 * 센서 이벤트는 60Hz까지 올라간다. 매 이벤트를 로그에 넣으면 상한이 1초도 못 버텨
 * "실기기 결과를 PC로 복사"라는 이 페이지의 목적이 무너진다. 채널별로 스로틀한다.
 * 화면의 실시간 값 표시는 스로틀과 무관하게 매 이벤트 갱신된다.
 */
const LOG_LIMIT = 200;
const SENSOR_LOG_INTERVAL_MS = 500;

const EMPTY_ORIENTATION: OrientationReading = {
  alpha: undefined,
  beta: undefined,
  gamma: undefined,
  absolute: undefined,
  webkitCompassHeading: undefined,
  webkitCompassAccuracy: undefined,
  count: 0,
  receivedAt: "—",
  receivedAtMs: 0,
};

const EMPTY_MOTION: MotionReading = {
  x: undefined,
  y: undefined,
  z: undefined,
  count: 0,
};

const pageStyle = {
  boxSizing: "border-box",
  maxWidth: 680,
  minHeight: "100vh",
  margin: "0 auto",
  padding: 12,
  color: "#172033",
  background: "#f4f6f8",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  fontSize: 13,
} as const;

const sectionStyle = {
  marginBottom: 12,
  padding: 12,
  border: "1px solid #cbd2da",
  borderRadius: 8,
  background: "#ffffff",
} as const;

const valueStyle = {
  overflowWrap: "anywhere",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

const buttonStyle = {
  minHeight: 40,
  marginBottom: 10,
  padding: "8px 12px",
  border: "1px solid #687386",
  borderRadius: 6,
  color: "#ffffff",
  background: "#173f6b",
  fontWeight: 700,
} as const;

function formatRaw(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(1) : String(value);
  return String(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function androidHeading(alpha: RawNumber): number | null {
  return typeof alpha === "number" && Number.isFinite(alpha) ? (360 - alpha) % 360 : null;
}

function iosHeading(value: RawNumber): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function directionForHeading(heading: number | null): string {
  if (heading === null) return "—";
  return DIRECTIONS[Math.round(heading / 45) % 8];
}

function ValueRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 42%) 1fr", gap: 8, padding: "2px 0" }}>
      <span>{label}</span>
      <span style={valueStyle}>{String(value)}</span>
    </div>
  );
}

function OrientationPanel({ title, reading }: { title: string; reading: OrientationReading }) {
  const iosCandidate = iosHeading(reading.webkitCompassHeading);
  const androidCandidate = androidHeading(reading.alpha);

  return (
    <div style={{ marginTop: 10, padding: 10, border: "1px solid #dce1e7", borderRadius: 6 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>{title}</h3>
      <ValueRow label="event.alpha" value={formatRaw(reading.alpha)} />
      <ValueRow label="event.beta" value={formatRaw(reading.beta)} />
      <ValueRow label="event.gamma" value={formatRaw(reading.gamma)} />
      <ValueRow label="event.absolute" value={formatRaw(reading.absolute)} />
      <ValueRow label="webkitCompassHeading" value={formatRaw(reading.webkitCompassHeading)} />
      <ValueRow label="webkitCompassAccuracy" value={formatRaw(reading.webkitCompassAccuracy)} />
      <ValueRow label="iOS heading 후보" value={formatRaw(iosCandidate)} />
      <ValueRow label="Android heading 후보" value={formatRaw(androidCandidate)} />
      <ValueRow label="수신 횟수" value={reading.count} />
      <ValueRow label="마지막 수신 시각" value={reading.receivedAt} />
    </div>
  );
}

function latestHeading(
  absoluteReading: OrientationReading,
  regularReading: OrientationReading,
): HeadingCandidate | null {
  const readings = [
    { reading: absoluteReading, eventName: "deviceorientationabsolute" },
    { reading: regularReading, eventName: "deviceorientation" },
  ];
  const webkitCandidates = readings.flatMap(({ reading, eventName }) => {
    const value = iosHeading(reading.webkitCompassHeading);
    return value === null
      ? []
      : [{ value, receivedAtMs: reading.receivedAtMs, source: `${eventName}.webkitCompassHeading` }];
  });
  const androidCandidates = readings.flatMap(({ reading, eventName }) => {
    const value = androidHeading(reading.alpha);
    return value === null ? [] : [{ value, receivedAtMs: reading.receivedAtMs, source: `${eventName}.alpha` }];
  });
  const candidates = webkitCandidates.length > 0 ? webkitCandidates : androidCandidates;
  return candidates.sort((a, b) => b.receivedAtMs - a.receivedAtMs)[0] ?? null;
}

function SensorCheckPage() {
  const [compassPermission, setCompassPermission] = useState("미요청");
  const [motionPermission, setMotionPermission] = useState("미요청");
  const [absoluteReading, setAbsoluteReading] = useState<OrientationReading>(EMPTY_ORIENTATION);
  const [regularReading, setRegularReading] = useState<OrientationReading>(EMPTY_ORIENTATION);
  const [motionReading, setMotionReading] = useState<MotionReading>(EMPTY_MOTION);
  const [motionPeak, setMotionPeak] = useState<number | null>(null);
  const [gpsState, setGpsState] = useState<GpsState>({ status: "idle" });
  const [logs, setLogs] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState("");
  const [fallbackLogText, setFallbackLogText] = useState<string | null>(null);

  const mountedRef = useRef(false);
  const orientationListeningRef = useRef(false);
  const motionListeningRef = useRef(false);
  const absoluteCountRef = useRef(0);
  const regularCountRef = useRef(0);
  const motionCountRef = useRef(0);
  const sensorLogAtRef = useRef<Record<string, number>>({});

  const addLog = useCallback((message: string) => {
    const line = `${new Date().toISOString()} ${message}`;
    setLogs((current) => [line, ...current].slice(0, LOG_LIMIT));
  }, []);

  /** 고빈도 센서 이벤트 전용 로그. 채널별로 SENSOR_LOG_INTERVAL_MS 간격을 둔다. */
  const addSensorLog = useCallback(
    (channel: string, message: string) => {
      const now = Date.now();
      const lastAt = sensorLogAtRef.current[channel] ?? 0;
      if (now - lastAt < SENSOR_LOG_INTERVAL_MS) return;
      sensorLogAtRef.current[channel] = now;
      addLog(message);
    },
    [addLog],
  );

  const handleAbsoluteOrientation = useCallback(
    (event: Event) => {
      const orientationEvent = event as DeviceOrientationEvent;
      // WebKit compass fields are runtime extensions missing from the standard DOM type.
      const webkitEvent = orientationEvent as DeviceOrientationEvent & WebKitOrientationFields;
      const now = new Date();
      absoluteCountRef.current += 1;
      const next: OrientationReading = {
        alpha: orientationEvent.alpha,
        beta: orientationEvent.beta,
        gamma: orientationEvent.gamma,
        absolute: orientationEvent.absolute,
        webkitCompassHeading: webkitEvent.webkitCompassHeading,
        webkitCompassAccuracy: webkitEvent.webkitCompassAccuracy,
        count: absoluteCountRef.current,
        receivedAt: now.toISOString(),
        receivedAtMs: now.getTime(),
      };
      setAbsoluteReading(next);
      addSensorLog(
        "deviceorientationabsolute",
        `deviceorientationabsolute #${next.count}: alpha=${formatRaw(next.alpha)}, beta=${formatRaw(next.beta)}, gamma=${formatRaw(next.gamma)}, absolute=${formatRaw(next.absolute)}, webkitCompassHeading=${formatRaw(next.webkitCompassHeading)}, webkitCompassAccuracy=${formatRaw(next.webkitCompassAccuracy)}`,
      );
    },
    [addSensorLog],
  );

  const handleRegularOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      // WebKit compass fields are runtime extensions missing from the standard DOM type.
      const webkitEvent = event as DeviceOrientationEvent & WebKitOrientationFields;
      const now = new Date();
      regularCountRef.current += 1;
      const next: OrientationReading = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute,
        webkitCompassHeading: webkitEvent.webkitCompassHeading,
        webkitCompassAccuracy: webkitEvent.webkitCompassAccuracy,
        count: regularCountRef.current,
        receivedAt: now.toISOString(),
        receivedAtMs: now.getTime(),
      };
      setRegularReading(next);
      addSensorLog(
        "deviceorientation",
        `deviceorientation #${next.count}: alpha=${formatRaw(next.alpha)}, beta=${formatRaw(next.beta)}, gamma=${formatRaw(next.gamma)}, absolute=${formatRaw(next.absolute)}, webkitCompassHeading=${formatRaw(next.webkitCompassHeading)}, webkitCompassAccuracy=${formatRaw(next.webkitCompassAccuracy)}`,
      );
    },
    [addSensorLog],
  );

  const handleMotion = useCallback(
    (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity;
      const x = acceleration?.x;
      const y = acceleration?.y;
      const z = acceleration?.z;
      motionCountRef.current += 1;
      const next: MotionReading = { x, y, z, count: motionCountRef.current };
      setMotionReading(next);

      if (typeof x === "number" && typeof y === "number" && typeof z === "number") {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        if (Number.isFinite(magnitude)) {
          setMotionPeak((current) => (current === null ? magnitude : Math.max(current, magnitude)));
        }
      }

      addSensorLog(
        "devicemotion",
        `devicemotion #${next.count}: accelerationIncludingGravity.x=${formatRaw(x)}, y=${formatRaw(y)}, z=${formatRaw(z)}`,
      );
    },
    [addSensorLog],
  );

  const startOrientationListeners = useCallback(() => {
    if (orientationListeningRef.current) return;
    window.addEventListener("deviceorientationabsolute", handleAbsoluteOrientation);
    window.addEventListener("deviceorientation", handleRegularOrientation);
    orientationListeningRef.current = true;
    addLog("나침반 리스너 등록: deviceorientationabsolute + deviceorientation");
  }, [addLog, handleAbsoluteOrientation, handleRegularOrientation]);

  const startMotionListener = useCallback(() => {
    if (motionListeningRef.current) return;
    window.addEventListener("devicemotion", handleMotion);
    motionListeningRef.current = true;
    addLog("모션 리스너 등록: devicemotion");
  }, [addLog, handleMotion]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.removeEventListener("deviceorientationabsolute", handleAbsoluteOrientation);
      window.removeEventListener("deviceorientation", handleRegularOrientation);
      window.removeEventListener("devicemotion", handleMotion);
      orientationListeningRef.current = false;
      motionListeningRef.current = false;
    };
  }, [handleAbsoluteOrientation, handleMotion, handleRegularOrientation]);

  const handleCompassStart = async () => {
    const constructor = window.DeviceOrientationEvent as PermissionCapableOrientationConstructor | undefined;
    if (constructor === undefined) {
      setCompassPermission("unsupported");
      addLog("나침반 권한 결과: unsupported (DeviceOrientationEvent 없음)");
      return;
    }

    if (typeof constructor.requestPermission === "function") {
      try {
        const result = await constructor.requestPermission();
        if (!mountedRef.current) return;
        setCompassPermission(result);
        addLog(`나침반 권한 결과: ${result}`);
        if (result === "granted") startOrientationListeners();
      } catch (error: unknown) {
        if (!mountedRef.current) return;
        const message = errorMessage(error);
        setCompassPermission(message);
        addLog(`나침반 권한 예외: ${message}`);
      }
      return;
    }

    setCompassPermission("unsupported");
    addLog("나침반 권한 결과: unsupported (requestPermission 없음)");
    startOrientationListeners();
  };

  const handleMotionStart = async () => {
    const constructor = window.DeviceMotionEvent as PermissionCapableMotionConstructor | undefined;
    if (constructor === undefined) {
      setMotionPermission("unsupported");
      addLog("모션 권한 결과: unsupported (DeviceMotionEvent 없음)");
      return;
    }

    if (typeof constructor.requestPermission === "function") {
      try {
        const result = await constructor.requestPermission();
        if (!mountedRef.current) return;
        setMotionPermission(result);
        addLog(`모션 권한 결과: ${result}`);
        if (result === "granted") startMotionListener();
      } catch (error: unknown) {
        if (!mountedRef.current) return;
        const message = errorMessage(error);
        setMotionPermission(message);
        addLog(`모션 권한 예외: ${message}`);
      }
      return;
    }

    setMotionPermission("unsupported");
    addLog("모션 권한 결과: unsupported (requestPermission 없음)");
    startMotionListener();
  };

  const handleGpsRequest = () => {
    setGpsState({ status: "loading" });
    addLog("GPS 위치 1회 요청 시작");

    if (!("geolocation" in navigator)) {
      const message = "Geolocation unsupported";
      setGpsState({ status: "error", code: 0, message });
      addLog(`GPS 실패: code=0, message=${message}`);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mountedRef.current) return;
        const next: GpsState = {
          status: "success",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setGpsState(next);
        addLog(
          `GPS 성공: latitude=${formatRaw(next.latitude)}, longitude=${formatRaw(next.longitude)}, accuracy=${formatRaw(next.accuracy)}, timestamp=${next.timestamp}`,
        );
      },
      (error) => {
        if (!mountedRef.current) return;
        setGpsState({ status: "error", code: error.code, message: error.message });
        addLog(`GPS 실패: code=${error.code}, message=${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };

  const handleCopyLogs = async () => {
    const fullText = logs.join("\n");
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unsupported");
      await navigator.clipboard.writeText(fullText);
      if (!mountedRef.current) return;
      setCopyStatus("복사 완료");
      setFallbackLogText(null);
      addLog("로그 복사 성공");
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const message = errorMessage(error);
      setCopyStatus(`복사 실패: ${message}`);
      setFallbackLogText(fullText);
      addLog(`로그 복사 실패: ${message}`);
    }
  };

  const currentHeading = useMemo(
    () => latestHeading(absoluteReading, regularReading),
    [absoluteReading, regularReading],
  );
  const userAgent = navigator.userAgent;
  const platform = /iPhone|iPad|iPod/i.test(userAgent)
    ? "iOS"
    : /Android/i.test(userAgent)
      ? "Android"
      : "기타";

  return (
    <main style={pageStyle}>
      <h1 style={{ margin: "4px 0 12px", fontSize: 21 }}>Spindle 센서 진단</h1>
      <p style={{ marginTop: -6, color: "#4d5968" }}>모든 값은 이 화면의 메모리에만 유지되며 전송되지 않습니다.</p>

      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>A — 환경</h2>
        <ValueRow label="navigator.userAgent" value={userAgent} />
        <ValueRow label="location.protocol" value={window.location.protocol} />
        <ValueRow label="location.origin" value={window.location.origin} />
        <ValueRow label="isSecureContext" value={String(window.isSecureContext)} />
        <ValueRow label="플랫폼 추정" value={platform} />
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>B — 나침반</h2>
        <button type="button" style={buttonStyle} onClick={handleCompassStart}>
          나침반 시작
        </button>
        <ValueRow label="권한 결과" value={compassPermission} />
        <div style={{ margin: "10px 0", padding: 12, borderRadius: 8, color: "#ffffff", background: "#101c2c" }}>
          <div style={{ fontSize: 12 }}>현재 heading 후보</div>
          <div style={{ ...valueStyle, fontSize: 32, fontWeight: 800 }}>
            {currentHeading === null ? "null" : `${formatRaw(currentHeading.value)}° ${directionForHeading(currentHeading.value)}`}
          </div>
          <div style={{ ...valueStyle, fontSize: 11 }}>{currentHeading?.source ?? "source: 없음"}</div>
        </div>
        <OrientationPanel title="deviceorientationabsolute" reading={absoluteReading} />
        <OrientationPanel title="deviceorientation" reading={regularReading} />
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>C — 모션 (흔들기)</h2>
        <button type="button" style={buttonStyle} onClick={handleMotionStart}>
          모션 시작
        </button>
        <ValueRow label="권한 결과" value={motionPermission} />
        <ValueRow label="acceleration.x" value={formatRaw(motionReading.x)} />
        <ValueRow label="acceleration.y" value={formatRaw(motionReading.y)} />
        <ValueRow label="acceleration.z" value={formatRaw(motionReading.z)} />
        <ValueRow label="수신 횟수" value={motionReading.count} />
        <ValueRow label="가속도 크기 peak" value={formatRaw(motionPeak)} />
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>D — GPS</h2>
        <button type="button" style={buttonStyle} onClick={handleGpsRequest}>
          위치 1회 가져오기
        </button>
        <ValueRow label="상태" value={gpsState.status} />
        {gpsState.status === "success" && (
          <>
            <ValueRow label="latitude" value={formatRaw(gpsState.latitude)} />
            <ValueRow label="longitude" value={formatRaw(gpsState.longitude)} />
            <ValueRow label="accuracy (m)" value={formatRaw(gpsState.accuracy)} />
            <ValueRow label="timestamp" value={gpsState.timestamp} />
          </>
        )}
        {gpsState.status === "error" && (
          <>
            <ValueRow label="error.code" value={gpsState.code} />
            <ValueRow label="error.message" value={gpsState.message} />
          </>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>E — 로그</h2>
        <button type="button" style={buttonStyle} onClick={handleCopyLogs}>
          로그 복사
        </button>
        {copyStatus && <span style={{ marginLeft: 8 }}>{copyStatus}</span>}
        {fallbackLogText !== null && (
          <textarea
            aria-label="복사할 로그 전문"
            readOnly
            value={fallbackLogText}
            style={{ ...valueStyle, boxSizing: "border-box", width: "100%", minHeight: 180, marginBottom: 8, fontSize: 11 }}
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
        <pre
          style={{
            ...valueStyle,
            boxSizing: "border-box",
            width: "100%",
            maxHeight: 360,
            margin: 0,
            padding: 8,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            border: "1px solid #dce1e7",
            background: "#f7f8fa",
            fontSize: 10,
          }}
        >
          {logs.length === 0 ? "로그 없음" : logs.join("\n")}
        </pre>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SensorCheckPage />
  </StrictMode>,
);
