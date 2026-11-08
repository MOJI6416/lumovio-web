/**
 * What a media element's error means for a viewing (S1). Before the first frame a decoder's (3) or the format's (4)
 * error is the file's: this browser can't play it. After the picture went, the same decoder or network (2) error is the
 * stream that broke — data that didn't come in time, a damaged piece — and the file plays: it restarts quietly from
 * where it stopped, once per place; a second break there is said as one ("The stream broke · Retry from 0:06").
 */
export function mediaFailure(code: number | null, at: number, resumedAt: number | null): "resume" | "broke" | "file" {
  if (at <= 0 || (code !== 2 && code !== 3)) return "file";
  return resumedAt === null || at > resumedAt + 30 ? "resume" : "broke";
}
