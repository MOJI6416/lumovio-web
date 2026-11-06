/*
 * The cut of a film as a release's name says it (design-system 7.15): its own module, so the places that only say a
 * release's facts (the sources screen, the player's panels) don't load the whole pick (lib/media/release-pick).
 */

/** A cut of the film as release names name it. */
export type Edition = "theatrical" | "extended" | "directors" | "final" | "unrated" | "imax";

const CUTS: [Exclude<Edition, "theatrical" | "imax">, RegExp][] = [
  // "Extended Edition", "Ext. Cut", "Special Extended", "Extended Collector's Cut", BvS's "Ultimate Edition".
  ["extended", /\bextended\b|\bext\.?[\s._-]*cut\b|\bultimate[\s._-]*(?:edition|cut)\b|расширенн|розширен/i],
  ["directors", /\bdirector'?s?[\s._-]*cut\b|режисс[её]рск|режисерськ/i],
  ["final", /\bfinal[\s._-]*cut\b|финальн[а-я]*\s+верси|фінальн[а-яії]*\s+версі/i],
  ["unrated", /\bunrated\b|\buncut\b|без[\s._-]+цензур/i],
];
const THEATRICAL = /\btheatrical\b|театральн|прокатн/i;
const IMAX = /\bimax\b/i;

/**
 * The cut a release's name says it is, or null when it names none. A name with the theatrical cut and another one
 * ("2-in-1: Theatrical & Director's Cut") is both, so neither; "IMAX" counts only when no cut is named ("[Extended]
 * [IMAX]" is the extended cut). "Remastered", "Special Edition", "Open Matte" are not cuts.
 */
export function editionOf(name: string): Edition | null {
  const cuts = CUTS.filter(([, re]) => re.test(name)).map(([e]) => e);
  const theatrical = THEATRICAL.test(name);
  if (theatrical) return cuts.length ? null : "theatrical";
  if (cuts.length) return cuts[0]!;
  return IMAX.test(name) ? "imax" : null;
}
