import { z } from "zod";

/** Content maturity ceiling for a profile. Mapped per region to official certifications on the server. */
export const MaturityLevel = z.enum(["kids", "family", "teen", "adult"]);
export type MaturityLevel = z.infer<typeof MaturityLevel>;

/** The avatar's colours (`--avatar-*`). */
export const AVATARS = [
  "aurora",
  "ember",
  "tide",
  "orbit",
  "bloom",
  "comet",
  "dusk",
  "prism",
  "nova",
  "lumen",
  "moss",
  "coral",
] as const;
export type AvatarColor = (typeof AVATARS)[number];

/**
 * A profile's avatar colour: the circle behind its photo, and with the name's first letter the
 * avatar itself when there is no photo (`Profile.photo`).
 */
export type AvatarId = AvatarColor;

/** Whether `v` is an avatar colour. */
export function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === "string" && (AVATARS as readonly string[]).includes(v);
}

/**
 * The colour of a saved or sent avatar value. Older versions let an avatar carry a drawn mark after a dot
 * (`"ember.fox"`); the marks are gone and such a value reads as its colour with the letter. null: not an avatar colour.
 */
export function avatarColorOf(v: unknown): AvatarId | null {
  if (typeof v !== "string") return null;
  const [color, mark, ...rest] = v.split(".");
  return rest.length === 0 && (mark === undefined || /^[a-z]+$/.test(mark)) && isAvatarId(color) ? color : null;
}

/** An avatar colour; a page still open from an older version may send one with its mark, which is dropped. */
export const AvatarId = z
  .string()
  .refine((v) => avatarColorOf(v) !== null, { message: "Unknown avatar" })
  .transform((v) => avatarColorOf(v)!);

/** The side, in pixels, of the square WebP a profile photo is kept as (`PUT /api/profiles/:id/photo`). */
export const PROFILE_PHOTO_SIZE = 512;

export const LocaleCode = z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/);

/**
 * How release search picks a picture version within the chosen audio: a balance for this device and
 * screen, the best known picture, or the smallest known file.
 */
export const ReleaseQuality = z.enum(["auto", "best", "small"]);
export type ReleaseQuality = z.infer<typeof ReleaseQuality>;

/**
 * What of an unwatched episode stays hidden until pressed: its still, its description, its name.
 * A guest gets the defaults.
 */
export const SpoilerPrefs = z.object({ stills: z.boolean(), overviews: z.boolean(), names: z.boolean() });
export type SpoilerPrefs = z.infer<typeof SpoilerPrefs>;
export const SPOILER_DEFAULTS: SpoilerPrefs = { stills: true, overviews: true, names: false };

/**
 * How subtitles look in the player: the size, the text's colour, what keeps it readable on the
 * picture (a shadow, an outline or a box behind it) and how high it stands. Text subtitles take all four; ASS keeps its
 * own colours and edges (size and height apply), PGS and VobSub pictures take the size and height. A guest and a new
 * profile get the defaults.
 */
export const SubtitleStyle = z.object({
  size: z.enum(["s", "m", "l", "xl"]),
  color: z.enum(["white", "yellow"]),
  edge: z.enum(["shadow", "outline", "box"]),
  position: z.enum(["bottom", "raised"]),
});
export type SubtitleStyle = z.infer<typeof SubtitleStyle>;
export const SUBTITLE_STYLE_DEFAULTS: SubtitleStyle = { size: "m", color: "white", edge: "shadow", position: "bottom" };

export interface Profile {
  id: string;
  name: string;
  avatar: AvatarId;
  /**
   * The profile's own photo: its address, a new one with every new photo, so it is cached for
   * good. null: the avatar is its colour with the name's first letter.
   */
  photo: string | null;
  isKids: boolean;
  maturity: MaturityLevel;
  hasPin: boolean;
  /** Interface language — independent from metadata/audio. */
  uiLocale: string | null;
  /** Language used for titles/overviews from TMDB. */
  metadataLocale: string | null;
  /** ISO 3166-1 region for certifications, release dates and legal streaming offers. */
  region: string | null;
  audioLanguages: string[];
  subtitleLanguages: string[];
  /** How subtitles look in the player. */
  subtitleStyle: SubtitleStyle;
  /** Dubbing and voice-over studios the profile prefers, in order; release search ranks them up. */
  voiceStudios: string[];
  /** The profile's default for picking a release's picture version; a title can pick another for one viewing. */
  releaseQuality: ReleaseQuality;
  spoilers: SpoilerPrefs;
  /**
   * Anime offered to the profile: off — no Anime section, and no anime on shelves, grids, picks or
   * "More like this". Search by name, a title's page and the profile's own lists and history keep it.
   */
  showAnime: boolean;
  handle: string | null;
  isPublic: boolean;
  createdAt: string;
}

export const ProfileCreate = z.object({
  name: z.string().trim().min(1).max(40),
  avatar: AvatarId,
  isKids: z.boolean().default(false),
  maturity: MaturityLevel.optional(),
  showAnime: z.boolean().default(true),
});
export type ProfileCreate = z.infer<typeof ProfileCreate>;

export const ProfileUpdate = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  avatar: AvatarId.optional(),
  maturity: MaturityLevel.optional(),
  uiLocale: LocaleCode.nullable().optional(),
  metadataLocale: LocaleCode.nullable().optional(),
  region: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  audioLanguages: z.array(z.string().min(2).max(3)).max(8).optional(),
  subtitleLanguages: z.array(z.string().min(2).max(3)).max(8).optional(),
  subtitleStyle: SubtitleStyle.optional(),
  voiceStudios: z.array(z.string().trim().min(2).max(40)).max(12).optional(),
  releaseQuality: ReleaseQuality.optional(),
  spoilers: SpoilerPrefs.optional(),
  showAnime: z.boolean().optional(),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdate>;

export const ProfilePin = z.object({
  pin: z
    .string()
    .regex(/^\d{4,8}$/)
    .nullable(),
  /** Required to change an existing PIN. */
  currentPin: z.string().optional(),
});

export const ProfileSelect = z.object({
  profileId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
  /** Account password: required to leave a kids profile for an unprotected adult one. */
  password: z.string().max(200).optional(),
  /** Or a code mailed to the account (`POST /api/profiles/select/code`) — the way for an account without a password. */
  code: z.string().regex(/^\d{6}$/).optional(),
});

/** `POST /api/profiles/select/code`: a code went to the account's mailbox. The answer never carries the code or the address. */
export interface LeaveCodeSent {
  /** false: this device was sent a code less than a minute ago, and that code still works. */
  sent: boolean;
  /** Seconds before "Send again" works. */
  resendAfter: number;
}

/**
 * A request to leave the kids profile approved on another device: the code and the address the TV
 * shows (QR), how long they work.
 */
export interface ProfileApprovalRequest {
  code: string;
  expiresIn: number;
  url: string;
}

export type ProfileApprovalState = "none" | "pending" | "approved" | "denied";

/** What the approving phone or computer is asked about. */
export interface ProfileApprovalDetails {
  from: { name: string; avatar: string; photo: string | null } | null;
  to: { name: string; avatar: string; photo: string | null };
  /** The device asking, in words ("TV · Android"). */
  device: string;
  status: ProfileApprovalState;
}

/**
 * `/api/profiles/pin-hint`: the hint to set a PIN on adult profiles while the account has a kids profile. "Not now"
 * hides it for the whole account until `snoozedUntil` (an ISO time); null — not put off.
 */
export interface PinHintState {
  snoozedUntil: string | null;
}

/** The first run for a new account: the setup screen not opened yet, its home shelf, or nothing. */
export type SetupOffer = "screen" | "shelf" | null;

/**
 * `/api/setup`: whether the account is offered the first run, and what it says about the account — its servers by
 * name and whether a history came in (an import or a Trakt/Simkl link). Not offered — empty.
 */
export interface SetupState {
  offer: SetupOffer;
  servers: string[];
  imported: boolean;
}

export const PublicProfileSettings = z.object({
  handle: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{3,24}$/)
    .nullable(),
  isPublic: z.boolean(),
  showFavorites: z.boolean(),
  showRatings: z.boolean(),
  showStats: z.boolean(),
  bio: z.string().max(280).nullable(),
});
export type PublicProfileSettings = z.infer<typeof PublicProfileSettings>;

export interface Me {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    role: "user" | "admin";
    twoFactorEnabled: boolean;
    createdAt: string;
  };
  activeProfile: Profile | null;
  profiles: Profile[];
  /** Which sign-in methods are linked to the account. */
  linkedProviders: string[];
  /** How many profiles an account may have (the admin's setting). */
  maxProfiles?: number;
}

export interface AuthCapabilities {
  emailPassword: boolean;
  google: boolean;
  apple: boolean;
  discord: boolean;
  turnstileSiteKey: string | null;
}

/**
 * What a sign-in's User-Agent says: a browser on a system, a TV (signed in with a code), an automated
 * sign-in (a script or a headless browser; `browser` is the tool, "curl", "HeadlessChrome") or nothing to go by.
 * Names are proper nouns ("Chrome", "Windows"); the client words the rest in the interface language.
 */
export interface DeviceInfo {
  client: "browser" | "tv" | "automated" | "unknown";
  browser: string | null;
  os: string | null;
}

export interface DeviceSession {
  id: string;
  current: boolean;
  userAgent: string | null;
  /** English fallback of `device` ("Chrome · Windows"). */
  deviceLabel: string;
  device: DeviceInfo;
  ipCountry: string | null;
  createdAt: string;
  lastSeenAt: string;
}

/*
 * "Watch on TV": a phone or a computer sends what it shows to a TV of the same
 * account where Lumovio is open, the TV starts it, and the sender drives that viewing. The TV says what it plays
 * (`TvPlayback`) to the senders listening; `failure` is why a viewing didn't start there.
 */
export type TvPlaybackState = "preparing" | "playing" | "paused" | "ended" | "failed";
/**
 * Why a sent viewing didn't start on the TV: `blocked` — the TV's browser refused an `http://` server; `unreachable` — the
 * server didn't answer the TV; `auth` — it refused the sign-in; `missing` — the copy sent isn't among the TV's; `none` — no
 * copy at all; `unsupported` — the file doesn't play there; `external` — only another app plays it; `other`.
 */
export type CastFailure = "blocked" | "unreachable" | "auth" | "missing" | "none" | "unsupported" | "external" | "other";

export interface TvPlayback {
  /** "movie:603". */
  titleId: string;
  kind: "movie" | "tv";
  tmdbId: number;
  /** The title in the TV's language. */
  title: string;
  season: number | null;
  episode: number | null;
  state: TvPlaybackState;
  positionSec: number;
  durationSec: number | null;
  /** The sending that opened this viewing (`CastAnswer.castId`); null for one started on the TV. */
  castId: string | null;
  failure: CastFailure | null;
  /** The profile the TV watches in. */
  profileId: string | null;
  /** When the TV said it (server time, ms). */
  at: number;
}

/** What a TV reports (POST /api/devices/playback): its viewing as it is, or that it has stopped. */
export type TvPlaybackReport = Omit<TvPlayback, "profileId" | "at"> | { state: "stopped" };

/** A TV of the account (GET /api/devices/tv): `online` — Lumovio is open on it now. */
export interface TvDevice {
  id: string;
  /** English fallback of `device` ("TV · Android"). */
  label: string;
  device: DeviceInfo;
  online: boolean;
  lastSeenAt: string;
  /** The profile chosen on the TV; null before one is. */
  profile: { id: string; name: string; isKids: boolean } | null;
  /** What it plays now (only while online; for a kids profile only a viewing in its own profile). */
  playback: TvPlayback | null;
}

/** What a phone sends to a TV (POST /api/devices/:id/cast): the viewing as the phone has it. */
export interface CastRequest {
  kind: "movie" | "tv";
  tmdbId: number;
  season?: number | null;
  episode?: number | null;
  /** The copy: "connectionId:externalId", as the player's `?source=`. */
  source?: string | null;
  /** The dubbing chosen with a TorrServer release (the player's `?voice=`). */
  voice?: string | null;
  /** The audio track chosen in the phone's player. */
  audio?: number | null;
  quality?: ReleaseQuality | null;
  /** Where the phone is in it; null — where the profile left it. */
  positionSec?: number | null;
  /** The TV is on another profile and the phone said to switch it to its own. */
  switchProfile?: boolean;
}

/**
 * The answer: sent; the TV isn't open; it's on another profile (`profile`; sent again with `switchProfile`); or a kids
 * phone can't take the TV out of its kids profile (`locked`).
 */
export type CastAnswer =
  | { status: "sent"; castId: string; switched: boolean }
  | { status: "offline" }
  | { status: "profile"; profile: { name: string; isKids: boolean } | null }
  | { status: "locked"; profile: { name: string; isKids: boolean } };

/** The phone's remote of a viewing on the TV (POST /api/devices/:id/playback). */
export type CastControl = { action: "toggle" | "stop" } | { action: "seek"; delta: number };
