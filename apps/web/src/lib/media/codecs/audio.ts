import {
  type AudioCodec,
  AudioSample,
  CustomAudioDecoder,
  type EncodedPacket,
  type InputAudioTrack,
  registerDecoder,
} from "mediabunny";
import { optional } from "../../optional";
import { codecWorker } from "./worker";

/*
 * Audio the browser can't decode, decoded in WebAssembly for the in-browser rebuild (`remux.ts`, which alone loads
 * this module): Dolby TrueHD / MLP always — Mediabunny doesn't know the codec, so its Matroska tracks are named
 * here — and MP3, FLAC, Vorbis where WebCodecs has no decoder for them. The decoders are FFmpeg's (LGPL-2.1), built by
 * scripts/player-codecs/build.sh into public/codecs/ and run in their own worker; AC-3/E-AC-3 and DTS come from
 * Mediabunny's own extensions.
 */

const call = codecWorker("/codecs/audio-worker.js");
/** The worker's decoders, by codec (legacy.ts uses AC-3 and MP2 for AVI files directly). */
export const AUDIO_DECODER: Record<string, number> = {
  truehd: 0,
  mlp: 1,
  mp3: 2,
  flac: 3,
  vorbis: 4,
  ac3: 5,
  mp2: 6,
};

type Answer = { samples: number; channels?: number; sampleRate?: number; pcm?: ArrayBuffer; ctx?: number };

/** MP3, FLAC and Vorbis are decoded here only where WebCodecs can't (`enableWasmDecoders`). */
const fallbacks = new Set<string>();
/** TrueHD's own downmix: its 2-channel or 5.1 presentation, whatever the rebuild encodes. */
let maxChannels = 6;

class WasmAudioDecoder extends CustomAudioDecoder {
  private ctx = 0;

  static override supports(codec: AudioCodec): boolean {
    const c = codec as string;
    return c === "truehd" || c === "mlp" || fallbacks.has(c);
  }

  override async init() {
    const description = this.config.description;
    const extradata = description
      ? new Uint8Array(
          ArrayBuffer.isView(description)
            ? description.buffer.slice(
                description.byteOffset,
                description.byteOffset + description.byteLength,
              )
            : description.slice(0),
        )
      : null;
    const r = await call<Answer>("init", {
      codec: AUDIO_DECODER[this.codec as string] ?? -1,
      maxChannels,
      channels: this.config.numberOfChannels,
      sampleRate: this.config.sampleRate,
      extradata: extradata?.buffer ?? null,
    });
    this.ctx = r.ctx ?? 0;
  }

  override async decode(packet: EncodedPacket) {
    const data = packet.data.slice().buffer;
    const r = await call<Answer>("decode", { ctx: this.ctx, data }, [data]);
    if (!r.samples || !r.pcm || !r.channels || !r.sampleRate) return;
    // Every sample decoded from a block starts at that block's time (no parser holds data back between blocks).
    this.onSample(
      new AudioSample({
        data: new Float32Array(r.pcm),
        format: "f32",
        numberOfChannels: r.channels,
        sampleRate: r.sampleRate,
        timestamp: packet.timestamp,
      }),
    );
  }

  override async flush() {}

  override async close() {
    // Closing never fails a playback: the worker's memory is freed with it anyway when the page goes.
    if (this.ctx) await optional(call<Answer>("close", { ctx: this.ctx }), undefined);
    this.ctx = 0;
  }
}

let registered = false;

/**
 * Registers the WebAssembly decoders for this rebuild: TrueHD/MLP, plus `codecs` (of mp3, flac, vorbis) that WebCodecs
 * can't decode here; `channels` is what the rebuild will encode (TrueHD then decodes that presentation).
 */
export function enableWasmDecoders(codecs: string[], channels: number) {
  for (const c of codecs) if (c === "mp3" || c === "flac" || c === "vorbis") fallbacks.add(c);
  maxChannels = channels <= 2 ? 2 : 6;
  if (!registered) {
    registered = true;
    registerDecoder(WasmAudioDecoder);
  }
}

type Backing = {
  internalTrack?: { codecId?: string };
  getCodec(): unknown;
  getDecoderConfig(): Promise<unknown>;
};

/**
 * Names the Matroska TrueHD / MLP tracks Mediabunny leaves without a codec (`A_TRUEHD`, `A_MLP`), so a conversion
 * hands their packets to the decoder above. Pinned to Mediabunny 1.62.1's track internals; with other internals the
 * tracks stay unnamed and the file goes to another app, as before. Returns the codec of each track it named.
 */
export function nameTrueHdTracks(tracks: InputAudioTrack[]): Map<InputAudioTrack, "truehd" | "mlp"> {
  const named = new Map<InputAudioTrack, "truehd" | "mlp">();
  for (const t of tracks) {
    const backing = (t as unknown as { _backing?: Backing })._backing;
    const id = backing?.internalTrack?.codecId;
    if (!backing || (id !== "A_TRUEHD" && id !== "A_MLP") || backing.getCodec() !== null) continue;
    const codec = id === "A_TRUEHD" ? "truehd" : "mlp";
    backing.getCodec = () => codec;
    backing.getDecoderConfig = async () => ({
      codec,
      numberOfChannels: await t.getNumberOfChannels(),
      sampleRate: await t.getSampleRate(),
    });
    named.set(t, codec);
  }
  return named;
}
