/*
 * Lumovio's old-video decoders in WebAssembly (video.js + video.wasm, built from FFmpeg's libavcodec, LGPL-2.1-or-later,
 * by scripts/player-codecs/build.sh): MPEG-4 Part 2 (Xvid, DivX), MS-MPEG-4, MPEG-1/2, H.263 — for AVI releases.
 * Started by apps/web/src/lib/media/legacy.ts; one message in, one answer out, with the same id.
 */
/* global importScripts, create_video */
importScripts("video.js");

let modulePromise = null;
let m = null;
let fns = null;

async function ready() {
  if (m) return;
  modulePromise ??= create_video();
  m = await modulePromise;
  fns = {
    init: m.cwrap("init_decoder", "number", ["number", "number", "number", "number", "number", "number"]),
    input: m.cwrap("input_buffer", "number", ["number", "number"]),
    decode: m.cwrap("decode", "number", ["number", "number"]),
    flush: m.cwrap("flush", "number", ["number"]),
    output: m.cwrap("output", "number", ["number"]),
    width: m.cwrap("output_width", "number", ["number"]),
    height: m.cwrap("output_height", "number", ["number"]),
    pts: m.cwrap("output_pts", "number", ["number", "number"]),
    close: m.cwrap("close_decoder", null, ["number"]),
  };
}

/** The pictures now in the decoder's output, each its own transferable I420 buffer. */
function pictures(ctx, count) {
  if (count <= 0) return { frames: [], transfer: [] };
  const w = fns.width(ctx);
  const h = fns.height(ctx);
  const size = (w * h * 3) / 2;
  const base = fns.output(ctx);
  const frames = [];
  for (let i = 0; i < count; i++) {
    const data = m.HEAPU8.slice(base + i * size, base + (i + 1) * size).buffer;
    frames.push({ data, width: w, height: h, pts: fns.pts(ctx, i) });
  }
  return { frames, transfer: frames.map((f) => f.data) };
}

const handlers = {
  async init({ codec, width, height, tag, extradata }) {
    await ready();
    let ptr = 0;
    const extra = extradata ? new Uint8Array(extradata) : null;
    if (extra?.length) {
      ptr = m._malloc(extra.length);
      m.HEAPU8.set(extra, ptr);
    }
    const ctx = fns.init(codec, width, height, tag >>> 0, ptr, extra?.length ?? 0);
    if (ptr) m._free(ptr);
    if (!ctx) throw new Error("decoder init failed");
    return { ctx };
  },
  async decode({ ctx, data, pts }) {
    const bytes = new Uint8Array(data);
    const at = fns.input(ctx, bytes.length);
    if (!at) throw new Error("out of memory");
    m.HEAPU8.set(bytes, at);
    const t0 = performance.now();
    const n = fns.decode(ctx, pts);
    const ms = performance.now() - t0;
    if (n < 0) throw new Error(`decode error ${n}`);
    const { frames, transfer } = pictures(ctx, n);
    return { frames, ms, transfer };
  },
  async flush({ ctx }) {
    const n = fns.flush(ctx);
    const { frames, transfer } = pictures(ctx, Math.max(0, n));
    return { frames, transfer };
  },
  async close({ ctx }) {
    if (m && ctx) fns.close(ctx);
    return {};
  },
};

self.onmessage = async (e) => {
  const { id, type, ...data } = e.data;
  try {
    const { transfer, ...result } = await handlers[type](data);
    self.postMessage({ id, ok: true, result }, transfer ?? []);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
