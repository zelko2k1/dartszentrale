// Test-Stub für das virtuelle Modul 'virtual:pwa-register' (vite-plugin-pwa).
// Dieses Modul existiert nur im Dev-Server und im Build — unter vitest (node) lässt es sich nicht
// auflösen, wodurch JEDE Testdatei abbrach, die indirekt den Store importiert (er zieht über
// lib/pwaUpdate.ts den Service-Worker-Registrar herein). Der Alias steht in vite.config.ts unter
// `test.alias`; hier reicht ein No-op, denn in Tests gibt es keinen Service Worker.
type RegisterSWOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (swUrl: string, r?: ServiceWorkerRegistration) => void;
  onRegisterError?: (error: unknown) => void;
};

export function registerSW(_options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
