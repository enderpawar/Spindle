import type { CSSProperties } from "react";
import { useInstallPrompt, usePwaNotice } from "./state";

export function PwaInstallBanner({
  buttonStyle,
  primaryButtonStyle,
}: {
  buttonStyle: CSSProperties;
  primaryButtonStyle: CSSProperties;
}) {
  const prompt = useInstallPrompt();
  if (!prompt.visible) return null;

  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        background: "rgba(255,255,255,0.07)",
      }}
      aria-label="앱 설치 안내"
    >
      <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.5, opacity: 0.86 }}>
        {prompt.ios
          ? "Safari 공유 버튼에서 홈 화면에 추가할 수 있어요."
          : "홈 화면에 설치하면 바로 열 수 있어요."}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        {prompt.canPrompt && (
          <button style={{ ...primaryButtonStyle, flex: 1, minHeight: 44, fontSize: 14 }} onClick={prompt.install}>
            설치
          </button>
        )}
        <button style={{ ...buttonStyle, flex: 1, minHeight: 44, fontSize: 14 }} onClick={prompt.dismiss}>
          나중에
        </button>
      </div>
    </section>
  );
}

export function PwaNoticeToast({ buttonStyle }: { buttonStyle: CSSProperties }) {
  const [notice, dismiss] = usePwaNotice();
  if (!notice) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: "calc(18px + env(safe-area-inset-bottom))",
        zIndex: 30,
        maxWidth: 448,
        margin: "0 auto",
        borderRadius: 14,
        background: "rgba(8,20,38,0.94)",
        border: "1px solid rgba(255,255,255,0.22)",
        color: "#F4F6FB",
        padding: 12,
        boxShadow: "0 18px 44px rgba(0,0,0,0.38)",
      }}
    >
      <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.45 }}>
        {notice === "update"
          ? "새 버전을 적용하고 있어요. 잠시 후 화면이 새로고침돼요."
          : "앱 화면은 오프라인에서도 열 수 있어요. 추천에는 네트워크가 필요해요."}
      </p>
      <button style={{ ...buttonStyle, minHeight: 36, padding: "6px 12px", fontSize: 13 }} onClick={dismiss}>
        확인
      </button>
    </div>
  );
}
