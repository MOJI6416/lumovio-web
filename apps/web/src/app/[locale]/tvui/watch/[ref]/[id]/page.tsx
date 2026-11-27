import { moveLegacy } from "@/lib/legacy-redirect";

type Params = Promise<{ locale: string; ref: string; id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/** An older player address on a TV: to the one on the title's code with the whole query, for good. */
export default async function TvLegacyWatchPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, ref, id } = await params;
  return moveLegacy(locale, `/watch/${ref}/${id}`, await searchParams);
}
