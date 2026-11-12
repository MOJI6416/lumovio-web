import { permanentRedirect } from "next/navigation";
import { getPathname } from "@/i18n/navigation";

/** The open collection was retired; old links (in every locale) land in the film catalogue. */
export default async function RetiredOpenCollection({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect(getPathname({ href: "/browse/movie", locale }));
}
