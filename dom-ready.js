/** Run after DOM is parsed (safe for deferred `type="module"` scripts). */
export function whenDocumentReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void fn());
  } else {
    void fn();
  }
}
