import { getTranslations } from "next-intl/server";
import { LibraryScreen } from "@/components/tvui/screens/LibraryScreen";

export async function generateMetadata() {
  const t = await getTranslations("library");
  return { robots: { index: false }, title: t("title") };
}

/** The library on a TV. */
export default function TvLibraryPage() {
  return <LibraryScreen />;
}
