/**
 * A cached page resumes its existing state; free resources only on final
 * exit. Extracted from PR #5 (commit 80e6db0) so back/forward-cache
 * restores never run against a disposed physics world.
 */
export function onFinalPageHide(cleanup: () => void) {
  const handle = (event: PageTransitionEvent) => {
    if (event.persisted) return;
    window.removeEventListener("pagehide", handle);
    cleanup();
  };
  window.addEventListener("pagehide", handle);
}
