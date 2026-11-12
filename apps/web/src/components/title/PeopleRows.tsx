"use client";

import type { CastMember, CrewMember } from "@lumovio/contracts";
import { useLocale, useTranslations } from "next-intl";
import { PersonCard } from "@/components/media/PersonCard";
import { Row } from "@/components/media/Row";
import { useJobText } from "@/components/person/job-label";
import { KEY_CREW } from "@/components/person/jobs";
import { latinLang } from "@/lib/format";

/**
 * "Cast" and "Crew" in "Details": shelves of PersonCards of the
 * shelf width, the name in up to two lines (never cut to one), the character or the job under it — jobs in the
 * interface language.
 */
export function PeopleRows({ cast, crew, creators }: { cast: CastMember[]; crew: CrewMember[]; creators: { id: number; name: string; profilePath: string | null; knownFor: string | null }[] }) {
  const t = useTranslations("title");
  const locale = useLocale();
  const job = useJobText();
  // The people who made it, each once with every job they had ("Director, Screenplay").
  const made = new Map<number, { person: CrewMember | (typeof creators)[number]; jobs: string[] }>();
  for (const c of creators) made.set(c.id, { person: c, jobs: ["Creator"] });
  for (const key of KEY_CREW)
    for (const c of crew.filter((x) => x.job === key)) {
      const row = made.get(c.id) ?? { person: c, jobs: [] };
      if (!row.jobs.includes(c.job)) row.jobs.push(c.job);
      made.set(c.id, row);
    }
  const makers = [...made.values()].slice(0, 16);
  return (
    <div className="flex flex-col gap-8 md:gap-12">
      {cast.length > 0 && (
        <Row title={t("cast")} kind="person" id="cast">
          {cast.slice(0, 30).map((c) => (
            <PersonCard key={`${c.id}-${c.character}`} person={c} subtitle={c.character} subtitleLang={latinLang(c.character, locale)} />
          ))}
        </Row>
      )}
      {makers.length > 0 && (
        <Row title={t("crew")} kind="person" id="crew">
          {makers.map(({ person, jobs }) => (
            <PersonCard
              key={person.id}
              person={person}
              subtitle={jobs.map(job).join(", ")}
            />
          ))}
        </Row>
      )}
    </div>
  );
}
