/**
 * The queue behind useConfirm/usePrompt, kept apart from the dialog itself so that <Toaster /> (on every page)
 * can load the confirmation host only when something actually asks (bundle budget).
 */
type Listener = () => void;

let queue: readonly unknown[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export const confirmQueue = {
  push(request: unknown) {
    queue = [...queue, request];
    emit();
  },
  shift() {
    queue = queue.slice(1);
    emit();
  },
  get: () => queue,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
