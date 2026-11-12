import { z } from "zod";

/*
 * The shared cache of releases' files: what a TorrServer read in a torrent's file (its audio tracks, subtitles and
 * picture), kept for every account. Releases reach it only as SHA-256 digests of their info hash and of their name —
 * never the hash, the name, a link or a tracker — with the size the name was found with.
 */

/** A SHA-256 digest in hex. */
const Digest = z.string().regex(/^[a-f0-9]{64}$/);

/** One stream of a file in ffprobe's words (TorrServer's ffprobe, or the player's own read of a Matroska file's head). */
export const ReleaseFileStream = z.object({
  index: z.number().int().min(0).max(1024),
  codec_type: z.string().max(16),
  codec_name: z.string().max(40),
  tags: z.object({ language: z.string().max(16).optional(), title: z.string().max(200).optional() }).optional(),
  disposition: z.object({ default: z.number().int().min(0).max(1).optional() }).optional(),
  bits_per_raw_sample: z.string().max(4).optional(),
  pix_fmt: z.string().max(32).optional(),
  width: z.number().int().min(0).max(16384).optional(),
  height: z.number().int().min(0).max(16384).optional(),
  side_data_list: z.array(z.object({ side_data_type: z.string().max(80).optional(), dv_profile: z.number().int().min(0).max(20).optional() })).max(8).optional(),
  color_transfer: z.string().max(32).optional(),
  channels: z.number().int().min(0).max(64).optional(),
});

/** A file's probe as a playback reads it. */
export const ReleaseFileProbe = z.object({
  format: z.object({ format_name: z.string().max(60).optional(), duration: z.string().max(24).optional(), bit_rate: z.string().max(24).optional() }).optional(),
  streams: z.array(ReleaseFileStream).min(1).max(128),
  chapters: z
    .array(z.object({ start_time: z.string().max(24), end_time: z.string().max(24), tags: z.object({ title: z.string().max(200).optional() }).optional() }))
    .max(300)
    .optional(),
});
export type ReleaseFileProbe = z.infer<typeof ReleaseFileProbe>;

/** A release's name as the cache knows it: the digest of the name and the size it was found with (bytes). */
const ReleaseName = z.object({ name: Digest, size: z.number().int().min(0).nullable() });

/**
 * One file a device read through its TorrServer: `torrent` — the digest of the torrent's info hash, `file` — the
 * file's index in it, `names` — the names the torrent was found or saved under. `v`: the reader's version — a read by
 * a newer reader replaces an older one's.
 */
export const ReleaseFileRead = z.object({
  torrent: Digest,
  file: z.number().int().min(0).max(100_000),
  probe: ReleaseFileProbe,
  names: z.array(ReleaseName).max(4),
  v: z.number().int().min(1).max(1000),
});
export type ReleaseFileRead = z.infer<typeof ReleaseFileRead>;

/** Search results to look up: by the torrent's digest when the result has a hash, else by its name and size. */
export const ReleaseFileLookup = z.object({
  releases: z.array(ReleaseName.extend({ torrent: Digest.nullable() })).max(100),
});
export type ReleaseFileLookup = z.infer<typeof ReleaseFileLookup>;

/** What the pick needs of a release's file. */
export interface ReleaseFileFacts {
  /** Its audio tracks in the file's order, "<language tag>|<title>" as the player names them ("rus|MVO, LostFilm"). */
  audio: string[];
  /** The position in `audio` of the track the file plays by default. */
  defaultAudio: number | null;
  /** Its subtitle tracks' language tags, in the file's order ("" when a track has none). */
  subtitles: string[];
  video: { codec: string | null; width: number | null; height: number | null; bits: number | null; dolbyVision: number | null; hdr: boolean } | null;
  durationSec: number | null;
}

/** Per release asked, in its order: what its file holds, or null when no device has read it. */
export interface ReleaseFilesFound {
  files: (ReleaseFileFacts | null)[];
}
