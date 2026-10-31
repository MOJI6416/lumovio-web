import { z } from "zod";
import type { TitleSummary } from "./media";

export const ImportSource = z.enum([
  "trakt",
  "simkl",
  "imdb",
  "letterboxd",
  "netflix",
  "lampa",
  "stremio",
  "lumovio",
]);
export type ImportSource = z.infer<typeof ImportSource>;

export type ImportStatus =
  | "uploaded"
  | "parsing"
  | "matching"
  | "review" // preview ready, waiting for user confirmation
  | "applying"
  | "done"
  | "failed"
  | "rolled_back";

export type ImportRowKind = "watch" | "rating" | "watchlist" | "favorite" | "list_item";

/** `restricted` — a title the target profile's age limit doesn't open; never applied (redesign-plan §5 п. 4). */
export type ImportRowStatus = "matched" | "ambiguous" | "unmatched" | "duplicate" | "skipped" | "applied" | "restricted";

export interface ImportStats {
  rows: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  duplicates: number;
  applied: number;
  byKind: Partial<Record<ImportRowKind, number>>;
  /** Rows left out for the target profile's age limit, and how many titles they are ("N titles skipped for age"). */
  restricted?: number;
  restrictedTitles?: number;
}

/**
 * Why an uploaded file was refused. Sent as the `file` issue of a `bad_request` (or `rate_limited`)
 * error, so the app can say it in the person's language (IMP-02).
 */
export type ImportFileProblem = "no_file" | "unreadable" | "unrecognised" | "empty" | "not_lumovio" | "daily_limit";

/** The step a failed import stopped at (IMP-01). The technical cause stays in the server log. */
export type ImportFailure = "match_failed" | "apply_failed";

export interface ImportJob {
  id: string;
  source: ImportSource;
  status: ImportStatus;
  /** A file upload, the first import when a Trakt/Simkl account is connected, or a later sync. */
  origin: "file" | "account" | "sync";
  profileId: string;
  profileName: string;
  fileName: string | null;
  stats: ImportStats;
  /** Set when `status` is "failed". */
  error: ImportFailure | null;
  createdAt: string;
  finishedAt: string | null;
  canRollback: boolean;
  /** A failed import can continue from the step it stopped at; so can a stalled one. */
  canRetry: boolean;
  /**
   * Still "matching" or "applying", but nothing is working on it: no background worker is connected, or its queue
   * job is gone or finished (IMP-03). It can be retried or deleted.
   */
  stalled?: boolean;
  /** The target profile is a kids one (titles over its age limit are left out). */
  profileIsKids?: boolean;
  /** Can be deleted now: anything but a running apply. Deleting keeps what was imported. */
  canDelete?: boolean;
}

export interface ImportRow {
  id: string;
  kind: ImportRowKind;
  status: ImportRowStatus;
  /** What the source file said, for display. */
  sourceTitle: string;
  sourceYear: number | null;
  sourceIds: Record<string, string>;
  season: number | null;
  episode: number | null;
  watchedAt: string | null;
  rating: number | null;
  listName: string | null;
  match: TitleSummary | null;
  candidates: TitleSummary[];
  confidence: number | null;
}

export const ImportRowResolve = z.object({
  rowIds: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(["accept", "skip", "choose"]),
  titleId: z
    .string()
    .regex(/^(movie|tv):\d+$/)
    .optional(),
  /** Also apply to every other open row of the same title in this import (e.g. all its episodes). */
  group: z.boolean().optional(),
});

export const ImportApply = z.object({
  includeKinds: z.array(z.enum(["watch", "rating", "watchlist", "favorite", "list_item"])).min(1),
  /** Keep personal ratings already present in Lumovio instead of overwriting them. */
  keepExistingRatings: z.boolean().default(true),
});

export interface ImportSourceInfo {
  source: ImportSource;
  method: "file" | "oauth";
  available: boolean;
  /** Accepted file extensions for file imports. */
  accept: string[];
  /** i18n key with export instructions. */
  helpKey: string;
}
