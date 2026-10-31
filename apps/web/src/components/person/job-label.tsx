"use client";

import { useTranslations } from "next-intl";
import { jobKey } from "./jobs";

/**
 * A TMDB job in the interface language, for the jobs that have a translation (the title page's crew is only those,
 * ./jobs KEY_CREW); others as TMDB gives them.
 */
export function useJobText() {
  const t = useTranslations("personPage");
  // biome-ignore lint/suspicious/noExplicitAny: the job_* keys are built from the list in ./jobs
  return (job: string): string => (jobKey(job) ? t(jobKey(job) as any) : job);
}
