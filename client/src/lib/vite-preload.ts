type ReloadPage = () => void;

export const installVitePreloadErrorHandler = (reloadPage: ReloadPage = () => window.location.reload()) => {
  const onPreloadError = (event: Event) => {
    event.preventDefault();
    reloadPage();
  };

  window.addEventListener("vite:preloadError", onPreloadError);

  return () => {
    window.removeEventListener("vite:preloadError", onPreloadError);
  };
};
