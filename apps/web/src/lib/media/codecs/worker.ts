/**
 * A codec worker of public/codecs/ (FFmpeg decoders in WebAssembly): one per script for the page, started on first use;
 * every call is one message with an id and one answer. A worker that fails to load fails every call, now and later.
 */
export type WorkerCall = <T>(
  type: string,
  data: Record<string, unknown>,
  transfer?: Transferable[],
) => Promise<T>;

const workers = new Map<string, WorkerCall>();

export function codecWorker(url: string): WorkerCall {
  const known = workers.get(url);
  if (known) return known;
  let worker: Worker | null = null;
  let failure: Error | null = null;
  let nextId = 0;
  const pending = new Map<number, { resolve: (a: unknown) => void; reject: (e: Error) => void }>();
  const call: WorkerCall = (type, data, transfer = []) => {
    if (failure) return Promise.reject(failure);
    if (!worker) {
      worker = new Worker(url);
      worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result: unknown; error: string }>) => {
        const p = pending.get(e.data.id);
        pending.delete(e.data.id);
        if (e.data.ok) p?.resolve(e.data.result);
        else p?.reject(new Error(e.data.error));
      };
      worker.onerror = (e) => {
        failure = new Error(e.message || `${url} failed to load`);
        for (const p of pending.values()) p.reject(failure);
        pending.clear();
      };
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve: resolve as (a: unknown) => void, reject });
      worker!.postMessage({ id, type, ...data }, transfer);
    });
  };
  workers.set(url, call);
  return call;
}
