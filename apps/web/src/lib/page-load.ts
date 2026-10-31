/**
 * Runs `fn` once the page has loaded — the window's load event, when the first screen's art and scripts are in — or at
 * once if it already has (a later client-side navigation). What can wait (the next billboard slide's art, controls
 * fetched ahead of use) waits for it, so on a slow network it doesn't share the line with the first screen's largest
 * image (performance-handoff §3: the nearest content first). Returns a cleanup.
 */
export function afterPageLoad(fn: () => void): () => void {
  if (document.readyState === "complete") {
    fn();
    return () => {};
  }
  window.addEventListener("load", fn, { once: true });
  return () => window.removeEventListener("load", fn);
}
