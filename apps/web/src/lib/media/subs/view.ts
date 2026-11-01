import type { SubtitleStyle } from "@lumovio/contracts";

/*
 * How a video's subtitles are shown right now, whatever draws them (the browser's cues, libass, a canvas): the timing
 * offset of this viewing (subtitles later when positive) and the profile's look. The player sets it; `engine.ts`
 * follows it. Cue times are kept as the file has them and moved by the offset, so changing it never adds up.
 */

/**
 * contracts' SUBTITLE_STYLE_DEFAULTS, kept here: a value import from the contracts package brings its zod schemas into the
 * player's and the settings' first load (bundle budget).
 */
export const SUBTITLE_DEFAULTS: SubtitleStyle = { size: "m", color: "white", edge: "shadow", position: "bottom" };

export interface SubtitleView {
  /** Seconds: positive shows each line later, negative earlier. */
  offset: number;
  style: SubtitleStyle;
}

/** One press of "earlier" / "later" (and of the G / H keys), and how far the offset goes either way. */
export const OFFSET_STEP = 0.5;
export const OFFSET_LIMIT = 30;

/** The offset after a step, within the limit, in tenths (no 0.30000000000000004). */
export function stepOffset(current: number, delta: number): number {
  return Math.round(Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, current + delta)) * 10) / 10;
}

type Listener = (view: SubtitleView, before: SubtitleView) => void;

interface State {
  view: SubtitleView;
  listeners: Set<Listener>;
}

const states = new WeakMap<HTMLVideoElement, State>();

function state(video: HTMLVideoElement): State {
  let s = states.get(video);
  if (!s) {
    s = { view: { offset: 0, style: SUBTITLE_DEFAULTS }, listeners: new Set() };
    states.set(video, s);
  }
  return s;
}

export function subtitleView(video: HTMLVideoElement): SubtitleView {
  return state(video).view;
}

/** Changes the view: every cue of the video's text tracks moves to the new offset, and the renderers hear of it. */
export function setSubtitleView(video: HTMLVideoElement, patch: Partial<SubtitleView>) {
  const s = state(video);
  const before = s.view;
  s.view = { ...before, ...patch };
  if (s.view.offset !== before.offset) for (const t of Array.from(video.textTracks)) shiftTrack(t, s.view.offset);
  // A copy: a renderer that starts again on a change replaces its listener meanwhile.
  for (const l of [...s.listeners]) l(s.view, before);
}

export function onSubtitleView(video: HTMLVideoElement, listener: Listener): () => void {
  const s = state(video);
  s.listeners.add(listener);
  return () => s.listeners.delete(listener);
}

/** A cue's own times, before any offset. */
const base = new WeakMap<object, [number, number]>();

/** Puts a cue at its own times plus `offset` (never before 0). */
export function shiftCue(cue: { startTime: number; endTime: number }, offset: number) {
  let b = base.get(cue);
  if (!b) {
    b = [cue.startTime, cue.endTime];
    base.set(cue, b);
  }
  const start = Math.max(0, b[0] + offset);
  const end = Math.max(start, b[1] + offset);
  if (cue.startTime !== start || cue.endTime !== end) {
    // The end first when moving later, so the cue never ends before it starts on the way.
    if (start > cue.startTime) {
      cue.endTime = end;
      cue.startTime = start;
    } else {
      cue.startTime = start;
      cue.endTime = end;
    }
  }
}

/** Every cue a track has loaded, at `offset` (a server's subtitle file arrives as the browser loads it). */
export function shiftTrack(track: TextTrack, offset: number) {
  for (const cue of Array.from(track.cues ?? [])) shiftCue(cue, offset);
}
