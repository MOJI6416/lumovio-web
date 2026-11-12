"use client";

import type { ListSummary } from "@lumovio/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";

// The dialogs load when the tile is pressed (bundle budget).
const CreateListDialog = lazy(() => import("./CreateListDialog").then((m) => ({ default: m.CreateListDialog })));
const ConnectListDialog = lazy(() => import("./ConnectListDialog").then((m) => ({ default: m.ConnectListDialog })));

/**
 * "New list" as the first card of the lists (as Apple Music's "New Playlist"): a ListCard's square
 * on --surface-2 with a plus and its name under it, the hover and focus of a card. It opens the "New list" dialog —
 * with following an MDBList list as the other way to start one, where the server can — and the new list opens with a
 * toast, so adding titles is right there. The library's shelf and the Lists page use it alike.
 */
export function NewListTile() {
  const t = useTranslations("library");
  const qc = useQueryClient();
  const router = useRouter();
  const { me } = useSession();
  const [open, setOpen] = useState<"create" | "connect" | null>(null);
  // Following an external list needs MDBList on the server and isn't offered to kids profiles.
  const sources = useQuery({
    queryKey: ["list-sources"],
    queryFn: () => api<{ mdblist: boolean }>("/api/lists/sources"),
    staleTime: 3_600_000,
    enabled: open !== null,
  });
  const canConnect = Boolean(sources.data?.mdblist) && !me?.activeProfile?.isKids;
  const created = async (l: ListSummary) => {
    void qc.invalidateQueries({ queryKey: ["lists"] });
    toast.success(t("listCreated", { list: l.name }));
    router.push(`/lists/${l.id}`);
  };
  return (
    <div className="group/card w-full min-w-0">
      <button /* ui-lint-ignore raw-button: the "New list" tile among the lists' cards, a card, not a Button */
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen("create")}
        className="group/link block w-full rounded-sm text-start focus-visible:outline-none"
      >
        <span className="grid aspect-square w-full place-items-center rounded-sm bg-surface-2 text-text-2 ring-line-2 transition-[scale,box-shadow,color] duration-base ease-base pointer-fine:group-hover/card:scale-[1.04] pointer-fine:group-hover/card:text-text-1 pointer-fine:group-hover/card:ring-2 group-focus-visible/link:scale-[1.04] group-focus-visible/link:outline-(length:--focus-width) group-focus-visible/link:outline-offset-2 group-focus-visible/link:outline-focus motion-reduce:scale-100!">
          <Plus aria-hidden className="size-8" />
        </span>
        <span className="mt-2 block text-title text-text-1">{t("newList")}</span>
      </button>
      <Suspense>
        {open === "create" && (
          <CreateListDialog
            open
            onOpenChange={(o) => !o && setOpen(null)}
            onCreated={created}
            onFollow={canConnect ? () => setOpen("connect") : undefined}
          />
        )}
        {open === "connect" && <ConnectListDialog open onOpenChange={(o) => !o && setOpen(null)} />}
      </Suspense>
    </div>
  );
}
