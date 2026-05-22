type ReloadPage = () => void;

const PRELOAD_RELOAD_STORAGE_PREFIX = "chat-app:vite-preload-reload:";
const PRELOAD_RELOAD_TTL_MS = 60_000;

const getCurrentBuildId = () =>
  document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? "unknown-build";

const getPreloadFailureId = (event: Event) => {
  const preloadEvent = event as Event & {
    detail?: unknown;
    payload?: unknown;
  };
  const payload = preloadEvent.payload ?? preloadEvent.detail;

  if (payload instanceof Error) {
    return payload.message;
  }

  if (typeof payload === "string") {
    return payload;
  }

  return "unknown-preload-error";
};

const shouldReloadForPreloadError = (event: Event) => {
  try {
    const key = `${PRELOAD_RELOAD_STORAGE_PREFIX}${getCurrentBuildId()}:${getPreloadFailureId(event)}`;
    const previousAttempt = Number.parseInt(window.sessionStorage.getItem(key) ?? "", 10);
    const now = Date.now();

    if (Number.isFinite(previousAttempt) && now - previousAttempt < PRELOAD_RELOAD_TTL_MS) {
      return false;
    }

    window.sessionStorage.setItem(key, String(now));
    return true;
  } catch {
    return false;
  }
};

export const installVitePreloadErrorHandler = (reloadPage: ReloadPage = () => window.location.reload()) => {
  const onPreloadError = (event: Event) => {
    if (!shouldReloadForPreloadError(event)) {
      return;
    }

    event.preventDefault();
    reloadPage();
  };

  window.addEventListener("vite:preloadError", onPreloadError);

  return () => {
    window.removeEventListener("vite:preloadError", onPreloadError);
  };
};
