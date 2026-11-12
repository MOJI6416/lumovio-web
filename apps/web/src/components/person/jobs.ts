/*
 * TMDB's crew jobs and departments come in English: the common ones are said in the interface
 * language through `personPage.job_*` keys; any other is shown as TMDB gives it, marked `lang="en"`.
 */

const JOBS = [
  "Director",
  "Co-Director",
  "Screenplay",
  "Writer",
  "Story",
  "Novel",
  "Characters",
  "Teleplay",
  "Creator",
  "Producer",
  "Executive Producer",
  "Co-Producer",
  "Original Music Composer",
  "Music",
  "Director of Photography",
  "Editor",
  "Casting",
  "Production Design",
  "Art Direction",
  "Costume Design",
  "Visual Effects Supervisor",
  "Animation",
  "Sound",
  "Voice",
  "Theme Song Performance",
  "Songs",
  "Associate Producer",
  "Co-Executive Producer",
  "Series Director",
  "Author",
  "Book",
  "Original Story",
  "Camera Operator",
  "Idea",
] as const;

export type KnownJob = (typeof JOBS)[number];

const KEY = Object.fromEntries(JOBS.map((j) => [j, `job_${j.replace(/[^A-Za-z]/g, "")}`])) as Record<KnownJob, string>;

/** The key of a job in `personPage`, or null for one we don't translate. */
export const jobKey = (job: string): string | null => (KEY as Record<string, string>)[job] ?? null;

/** The crew a title page names in "Details": the people who made it, in this order (not every assistant). */
export const KEY_CREW: KnownJob[] = ["Director", "Creator", "Screenplay", "Writer", "Novel", "Story", "Original Music Composer", "Director of Photography", "Editor", "Producer"];
