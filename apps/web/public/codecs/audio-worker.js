/*
 * Lumovio's audio decoders in WebAssembly (audio.js + audio.wasm, built from FFmpeg's libavcodec, LGPL-2.1-or-later,
 * by scripts/player-codecs/build.sh): Dolby TrueHD / MLP, and MP3, FLAC, Vorbis where the browser has no decoder.
 * Started by apps/web/src/lib/media/codecs/audio.ts; one message in, one answer out, with the same id.
 */
/* global importScripts, create_audio */
importScripts("audio.js");

let modulePromise = null;
let m = null;
let fns = null;

async function ready() {
  if (m) return;
  modulePromise ??= create_audio();
  m = await modulePromise;
  fns = {
    init: m.cwrap("init_decoder", "number", ["number", "number", "number", "number", "number", "number"]),
    input: m.cwrap("input_buffer", "number", ["number", "number"]),
    decode: m.cwrap("decode", "number", ["number"]),
    output: m.cwrap("output", "number", ["number"]),
    channels: m.cwrap("output_channels", "number", ["number"]),
    rate: m.cwrap("output_rate", "number", ["number"]),
    close: m.cwrap("close_decoder", null, ["number"]),
  };
}

const handlers = {
  async init({ codec, maxChannels, channels, sampleRate, extradata }) {
    await ready();
    let ptr = 0;
    const extra = extradata ? new Uint8Array(extradata) : null;
    if (extra?.length) {
      ptr = m._malloc(extra.length);
      m.HEAPU8.set(extra, ptr);
    }
    const ctx = fns.init(codec, maxChannels, channels, sampleRate, ptr, extra?.length ?? 0);
    if (ptr) m._free(ptr);
    if (!ctx) throw new Error("decoder init failed");
    return { ctx };
  },
  async decode({ ctx, data }) {
    const bytes = new Uint8Array(data);
    const at = fns.input(ctx, bytes.length);
    if (!at) throw new Error("out of memory");
    m.HEAPU8.set(bytes, at);
    const samples = fns.decode(ctx);
    if (samples < 0) throw new Error(`decode error ${samples}`);
    if (samples === 0) return { samples: 0 };
    const channels = fns.channels(ctx);
    const out = fns.output(ctx) >> 2;
    const pcm = m.HEAPF32.slice(out, out + samples * channels);
    return { samples, channels, sampleRate: fns.rate(ctx), pcm: pcm.buffer, transfer: [pcm.buffer] };
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
