import type { EncodedPacket, InputVideoTrack, PacketType } from "mediabunny";

/*
 * H.264 key frames a rebuild can cut and start at. A Blu-ray's video keeps IDR frames for scene cuts — half a minute
 * apart, or more — and begins every second with an I-frame that carries a recovery point: the container marks it as a
 * key frame, and decoders start from it. Mediabunny in Chromium counts only IDR (the rule of WebCodecs there), so a
 * rebuild's first fragment ran to the next IDR — 96 MB of a 44 Mbit/s film before anything reached the player — and a
 * rebuild from the middle of the film walked back from I-frame to I-frame, a request each, looking for an IDR. Media
 * Source in Chromium plays from a recovery point, as it does in Safari and Firefox, where Mediabunny counts them itself.
 */

/** The NAL units of an access unit before its first slice: length-prefixed (MP4, Matroska), or Annex B with no length. */
function* nalsBeforeSlice(data: Uint8Array, lengthSize: number | null): Generator<Uint8Array> {
  if (lengthSize) {
    for (let at = 0; at + lengthSize < data.length; ) {
      let length = 0;
      for (let i = 0; i < lengthSize; i++) length = length * 256 + data[at + i]!;
      const start = at + lengthSize;
      const type = data[start]! & 31;
      if (type >= 1 && type <= 5) return;
      yield data.subarray(start, start + length);
      at = start + length;
    }
    return;
  }
  // Annex B: a unit runs from one start code (00 00 01) to the next.
  const startCode = (from: number) => {
    for (let i = from; i + 3 < data.length; i++) if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) return i;
    return -1;
  };
  for (let code = startCode(0); code >= 0; ) {
    const start = code + 3;
    const type = data[start]! & 31;
    if (type >= 1 && type <= 5) return;
    const next = startCode(start);
    yield data.subarray(start, next < 0 ? data.length : next);
    code = next;
  }
}

const SEI = 6;
const RECOVERY_POINT = 6;

/**
 * Whether an H.264 access unit carries a recovery point that decoding starts at exactly — recovery_frame_cnt 0 and
 * exact_match_flag 1, what browsers agreed to take for a key frame besides IDR. `lengthSize`: the bytes of a unit's
 * length in MP4 and Matroska packets, null for Annex B.
 */
export function isRecoveryPoint(data: Uint8Array, lengthSize: number | null): boolean {
  for (const nal of nalsBeforeSlice(data, lengthSize)) {
    if ((nal[0]! & 31) !== SEI) continue;
    // The payload without the emulation prevention bytes (00 00 03 → 00 00).
    const b: number[] = [];
    for (let i = 1; i < nal.length; i++) if (!(nal[i] === 3 && i >= 3 && nal[i - 1] === 0 && nal[i - 2] === 0)) b.push(nal[i]!);
    // Messages: a type and a size, each a run of 255s and a last byte, then the payload; one byte of trailing bits ends them.
    for (let at = 0; at + 2 < b.length; ) {
      let type = 0;
      while (b[at] === 255) type += b[at++]!;
      type += b[at++] ?? 0;
      let size = 0;
      while (b[at] === 255) size += b[at++]!;
      size += b[at++] ?? 0;
      if (type === RECOVERY_POINT) {
        // recovery_frame_cnt is ue(v): zero is the single bit 1; exact_match_flag is the bit after it.
        const first = b[at] ?? 0;
        return (first & 0x80) !== 0 && (first & 0x40) !== 0;
      }
      at += size;
    }
  }
  return false;
}

type Verifying = { determinePacketType?: (packet: EncodedPacket) => Promise<PacketType | null> };

/**
 * Makes a rebuild count those I-frames of `track` as key frames: its fragments are cut at them, and it starts at the one
 * before the time asked. Only a packet the container itself marks as a key frame is looked at. Pinned to Mediabunny
 * 1.62.1, whose readers ask the track for a packet's real type; with other internals the track stays as it was.
 */
export function keyAtRecoveryPoints(track: InputVideoTrack) {
  const t = track as unknown as Verifying;
  const verify = t.determinePacketType;
  if (track.codec !== "avc" || typeof verify !== "function") return;
  let lengthSize: number | null | undefined;
  t.determinePacketType = async (packet) => {
    const type = await verify.call(track, packet);
    if (type !== "delta" || packet.type !== "key") return type;
    if (lengthSize === undefined) {
      // avcC: the fifth byte's low two bits are the length's size minus one. No description: Annex B.
      const d = (await track.getDecoderConfig())?.description;
      const avcc = d ? (ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : new Uint8Array(d as ArrayBuffer)) : null;
      lengthSize = avcc && avcc.length > 4 ? (avcc[4]! & 3) + 1 : null;
    }
    return isRecoveryPoint(packet.data, lengthSize) ? "key" : "delta";
  };
}
