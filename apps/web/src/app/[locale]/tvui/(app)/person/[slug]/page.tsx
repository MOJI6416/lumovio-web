import type { PersonDetails } from "@lumovio/contracts";
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PendingDetails } from "@/components/ui/PendingDetails";
import { PersonScreen } from "@/components/tvui/screens/PersonScreen";
import { TextCredit } from "@/components/ui/SourceCredit";
import { TvBackButton } from "@/components/tvui/shell/TvBackButton";
import { TvState } from "@/components/tvui/shell/TvState";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";
import { parseCodeSlug, parseSlugId } from "@/lib/address-read";

export async function generateMetadata() {
  return { robots: { index: false } };
}

/** A person on a TV. */
export default async function TvPersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The code; an older address's TMDB id is read too (a TV needs no canonical address).
  const ref = parseCodeSlug(slug) ?? parseSlugId(slug);
  const p = ref ? await optional(serverApi<PersonDetails>(`/api/catalog/person/${ref}`), null) : null;
  if (!p) {
    const t = await getTranslations("errors");
    return (
      <div data-tv-screen="detail" className="flex h-full flex-col justify-center ps-(--tv-pad) pe-(--gutter)">
        <TvState icon={SearchX} title={t("notFoundTitle")}>
          <TvBackButton initial />
        </TvState>
      </div>
    );
  }
  // Each title once, the most known first (as the site's "Known for").
  const seen = new Set<string>();
  const credits = [...p.credits]
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .sort((a, b) => (b.tmdbVotes ?? 0) - (a.tmdbVotes ?? 0))
    .slice(0, 60)
    .map(({ role: _r, as: _a, jobs: _j, characters: _c, overview: _o, ...x }) => ({ ...x, overview: null }));
  return (
    <>
      <PersonScreen person={{ ...p, credits: [] }} credits={credits} credit={p.biographyCredit ? <TextCredit credit={p.biographyCredit} tv /> : null} />
      {p.pending && <PendingDetails quiet />}
    </>
  );
}
