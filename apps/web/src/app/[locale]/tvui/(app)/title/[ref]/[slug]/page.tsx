import { moveLegacy } from "@/lib/legacy-redirect";

type Params = Promise<{ locale: string; ref: string; slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/** An older title address on a TV: to the one on the title's code, for good. */
export default async function TvLegacyTitlePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, ref, slug } = await params;
  return moveLegacy(locale, `/title/${ref}/${slug}`, await searchParams);
}
