/** A cached page will resume its existing state; free resources only on final exit. */
export function onFinalPageHide(cleanup: () => void) {
  const handle = (event: PageTransitionEvent) => {
    if (event.persisted) return;
    window.removeEventListener("pagehide", handle);
    cleanup();
  };
  window.addEventListener("pagehide", handle);
}
