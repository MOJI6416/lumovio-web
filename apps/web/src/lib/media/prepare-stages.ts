/**
 * The real stages of starting a source, in order. Each source goes through the ones that apply to it:
 * a release picked from search is added to the TorrServer first; a whole torrent lists its files and
 * the film's or episode's file is chosen; an episode on Jellyfin/Plex is looked up; every source has
 * its file read (format, tracks) and then plays in the player, which buffers. No stage has a percent:
 * nothing reports one honestly.
 */
export type PrepStage = "add" | "files" | "file" | "probe" | "play";

export interface PrepSource {
  provider: "jellyfin" | "plex" | "torrserver";
  /** A TorrServer source already pointing at one file ("<hash>:<fileIndex>"). */
  bound: boolean;
}

/** The stages a source goes through. `added`: it was just added from search; `episode`: an episode is wanted. */
export function stagesFor(s: PrepSource, opts: { added: boolean; episode: boolean }): PrepStage[] {
  const out: PrepStage[] = [];
  if (opts.added && s.provider === "torrserver") out.push("add");
  if (s.provider === "torrserver") {
    if (!s.bound) out.push("files");
    out.push("file");
  } else if (opts.episode) out.push("file");
  out.push("probe", "play");
  return out;
}

export interface Prep {
  stages: PrepStage[];
  /** The stage under way, or the one that failed. */
  at: PrepStage;
  /** What each finished stage found, in plain words. */
  facts: Partial<Record<PrepStage, string>>;
}

/** Whether a stage is finished, under way (or failed) or still ahead. */
export function stageState(p: Prep, s: PrepStage): "done" | "current" | "ahead" {
  const i = p.stages.indexOf(s);
  const at = p.stages.indexOf(p.at);
  return i < at ? "done" : i === at ? "current" : "ahead";
}
