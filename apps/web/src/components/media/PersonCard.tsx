import type { PersonSummary } from "@lumovio/contracts";
import { Link } from "@/i18n/navigation";
import { tmdbImage } from "@/lib/images";
import { personHref } from "@/lib/slug";
import { Artwork } from "./Artwork";
import { CardMeta } from "./CardMeta";

/**
 * Person card (design-system 7.12, sizes 5.4): a round photo, or the person icon on --surface-2 without one; the name
 * and the role ("Paul Atreides", "Acting") under it. The width comes from the shelf or grid around it. `subtitleLang`
 * marks a subtitle the source doesn't translate (TMDB's character names, 8.11).
 */
export function PersonCard({ person, subtitle, subtitleLang }: { person: PersonSummary; subtitle?: string | null; subtitleLang?: string }) {
  return (
    <div className="group/card w-full min-w-0">
      <Link href={personHref(person.id, person.name)} className="group/link block focus-visible:outline-none">
        {/* The name under it names the link. */}
        <Artwork shape="person" src={tmdbImage(person.profilePath, "w185")} placeholder="person" sizes="136px" />
        <CardMeta title={person.name} meta={[subtitle && subtitleLang ? <span key="role" lang={subtitleLang}>{subtitle}</span> : subtitle]} align="center" />
      </Link>
    </div>
  );
}
