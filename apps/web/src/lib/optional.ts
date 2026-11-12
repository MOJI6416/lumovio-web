/*
 * Requests whose failure the person is not meant to see, said so by name instead of a silent
 * `.catch(() => null)`. Neither is for a person's own action — that goes through lib/use-action and
 * reports its failure — nor for the data a page or section exists to show, which shows ErrorState.
 */

/**
 * A part the page can do without (a missing section is hidden, not shown as "no data"): the genres of a picker,
 * the first page rendered on the server that the browser loads again by itself, an optional extra of a stream. When the request fails, `fallback` stands in for it.
 */
export function optional<T, F>(request: Promise<T>, fallback: F): Promise<T | F> {
  return request.catch((_failure: unknown) => fallback);
}

/**
 * A report or a clean-up nobody waits on — diagnostics, a progress beat, "start this copy first next time", closing
 * a stream that is being replaced: the next one carries the state, so a failure is dropped on purpose.
 */
export function background(request: Promise<unknown>): void {
  void optional(request, undefined);
}
