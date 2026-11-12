/**
 * Sharing a page: a phone or tablet gets the system's share sheet; a computer — where that sheet
 * is missing (Firefox) or poor (Windows) — gets Lumovio's own window with the link to copy, the services and a QR code
 * for a phone (./ShareDialog, mounted by <Toaster /> only while a request is open, bundle budget).
 */
export interface ShareRequest {
  title: string;
  url: string;
}

type Listener = () => void;
let current: ShareRequest | null = null;
const listeners = new Set<Listener>();
const emit = () => {
  for (const l of listeners) l();
};

export const shareStore = {
  get: () => current,
  close() {
    current = null;
    emit();
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Opens the share sheet for a page; closing the system's sheet is not a failure. */
export async function sharePage(request: ShareRequest): Promise<void> {
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (touch && navigator.share) {
    try {
      await navigator.share(request);
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Refused (no user gesture left, a policy): Lumovio's own sheet below.
    }
  }
  current = request;
  emit();
}
