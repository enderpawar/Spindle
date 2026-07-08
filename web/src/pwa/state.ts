import { useEffect, useMemo, useState } from "react";
import { canRecommendWhileOffline } from "./cachePolicy";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export type PwaNoticeKind = "offline-ready" | "update" | null;

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return typeof (event as BeforeInstallPromptEvent).prompt === "function";
}

function isStandalone(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isIosSafariInstallCandidate(): boolean {
  const ua = navigator.userAgent;
  const isiOS = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isiOS && isSafari && !isStandalone();
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : canRecommendWhileOffline(navigator.onLine),
  );

  useEffect(() => {
    const update = () => setOnline(canRecommendWhileOffline(navigator.onLine));
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

export function usePwaNotice(): [PwaNoticeKind, () => void] {
  const [notice, setNotice] = useState<PwaNoticeKind>(null);

  useEffect(() => {
    const offlineReady = () => setNotice("offline-ready");
    const update = () => setNotice("update");
    window.addEventListener("spindle-pwa-offline-ready", offlineReady);
    window.addEventListener("spindle-pwa-update", update);
    return () => {
      window.removeEventListener("spindle-pwa-offline-ready", offlineReady);
      window.removeEventListener("spindle-pwa-update", update);
    };
  }, []);

  return [notice, () => setNotice(null)];
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(() => (typeof window === "undefined" ? false : isStandalone()));

  useEffect(() => {
    const onPrompt = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      setPromptEvent(event);
      setDismissed(false);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const ios = useMemo(() => (typeof navigator === "undefined" ? false : isIosSafariInstallCandidate()), []);
  const visible = !installed && !dismissed && (promptEvent !== null || ios);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    setDismissed(true);
  }

  return {
    visible,
    ios,
    canPrompt: promptEvent !== null,
    install,
    dismiss: () => setDismissed(true),
  };
}
