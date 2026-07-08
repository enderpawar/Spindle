import { registerSW } from "virtual:pwa-register";

let registered = false;

export function registerSpindlePwa(): void {
  if (registered || typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  registered = true;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent("spindle-pwa-update"));
      window.setTimeout(() => updateSW(true), 900);
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent("spindle-pwa-offline-ready"));
    },
    onRegisteredSW(_swUrl, registration) {
      registration?.update();
      window.setInterval(() => registration?.update(), 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error("PWA 등록 실패:", error);
    },
  });
}
