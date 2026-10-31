import type { ListDetails } from "@lumovio/contracts";
import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ListScreen } from "@/components/tvui/screens/ListScreen";
import { TvBackButton } from "@/components/tvui/shell/TvBackButton";
import { TvState } from "@/components/tvui/shell/TvState";
import { optional } from "@/lib/optional";
import { serverApi } from "@/lib/server-api";

export async function generateMetadata() {
  return { robots: { index: false } };
}

/** A list on a TV (S10 TV): a list this profile can't open is said, with the way back. */
export default async function TvListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("tvui");
  const list = /^[\w-]{1,64}$/.test(id) ? await optional(serverApi<ListDetails>(`/api/lists/${id}`), null) : null;
  if (!list)
    return (
      <div data-tv-screen="detail" className="flex h-full flex-col justify-center ps-(--tv-pad) pe-(--gutter)">
        <TvState icon={Lock} title={t("listUnavailable")}>
          <TvBackButton initial />
        </TvState>
      </div>
    );
  return <ListScreen id={id} initial={list} />;
}
