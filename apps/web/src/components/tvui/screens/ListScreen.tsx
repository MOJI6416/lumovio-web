"use client";

import type { ListDetails, TitleSummary } from "@lumovio/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ListVideo, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FocusEvent, useMemo, useState } from "react";
import { CardRating } from "@/components/media/CardRating";
import { TvButton } from "@/components/ui/tv/TvButton";
import { api } from "@/lib/api";
import { TvCard } from "../media/TvCard";
import { TvState } from "../shell/TvState";

/** A list on a TV (S10 TV): its name, owner and count, then its titles as a grid, page after page (LIB-24). */
export function ListScreen({ id, initial }: { id: string; initial: ListDetails }) {
  const tc = useTranslations("common");
  const tv = useTranslations("tvui");
  const [focused, setFocused] = useState<TitleSummary | null>(null);
  const q = useInfiniteQuery({
    queryKey: ["list-tv", id],
    queryFn: ({ pageParam }) => api<ListDetails>(`/api/lists/${id}?offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    initialData: { pages: [initial], pageParams: [0] },
  });
  const titles = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.items.map((i) => i.title)), [q.data]);
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const i = Number((e.target as HTMLElement).dataset.index);
    setFocused(titles[i] ?? null);
    if (i >= titles.length - 14 && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
  };
  return (
    <div data-tv-screen="detail" className="relative h-full">
      <div data-tv-scroller className="absolute inset-0 overflow-hidden">
        <div data-tv-content className="flex flex-col gap-8 pb-24">
          <header data-zone-frame="top" className="flex flex-col gap-3 ps-(--tv-pad) pe-(--gutter) pt-12">
            <h1 className="text-h1 text-text-1">{initial.name}</h1>
            <p className="text-body-l text-text-2 tabular-nums">
              {[tc("titlesCount", { count: initial.itemCount }), initial.owner.name].join(" · ")}
            </p>
            {initial.description && <p className="max-w-measure text-body-l text-text-2">{initial.description}</p>}
            <div className="flex h-9 items-center gap-4 text-body-l text-text-2" aria-live="polite">
              {focused && (
                <>
                  <span className="truncate font-semibold text-text-1">{focused.title}</span>
                  {focused.year && <span>{focused.year}</span>}
                  <CardRating title={focused} className="text-text-1" />
                </>
              )}
            </div>
          </header>
          <div className="ps-(--tv-pad) pe-(--gutter)">
            {titles.length === 0 ? (
              <TvState icon={ListVideo} title={tv("listEmpty")} />
            ) : (
              <div data-zone="grid" data-zone-axis="grid" onFocus={onFocus} className="grid grid-cols-7 gap-x-6 gap-y-8">
                {titles.map((x, i) => (
                  <TvCard key={x.id} title={x} index={i} fluid />
                ))}
                {q.isFetchNextPageError && (
                  <TvButton icon={RefreshCw} onClick={() => void q.fetchNextPage()}>
                    {tc("retry")}
                  </TvButton>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
