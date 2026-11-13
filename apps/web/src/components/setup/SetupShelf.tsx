"use client";

import type { SetupState } from "@lumovio/contracts";
import { Check, History, Languages, type LucideIcon, Server } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Row } from "@/components/media/Row";
import { useSession } from "@/components/providers/Providers";
import { useAudioValue } from "@/components/settings/profile-values";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";

/**
 * A tile of the shelf: a 16:9 surface with the step's mark, its name and state under it — a card's look and focus,
 * as the lists' "New list" tile has them; a step done says so with a check.
 */
function Tile({ href, icon: Icon, title, state, done }: { href: string; icon: LucideIcon; title: string; state: ReactNode; done?: boolean }) {
  return (
    <div className="group/card w-full min-w-0">
      <Link href={href} className="group/link block w-full rounded-sm text-start focus-visible:outline-none">
        <span className="grid aspect-video w-full place-items-center rounded-sm bg-surface-2 text-text-2 ring-line-2 transition-[scale,box-shadow,color] duration-base ease-base pointer-fine:group-hover/card:scale-[1.04] pointer-fine:group-hover/card:text-text-1 pointer-fine:group-hover/card:ring-2 group-focus-visible/link:scale-[1.04] group-focus-visible/link:outline-(length:--focus-width) group-focus-visible/link:outline-offset-2 group-focus-visible/link:outline-focus motion-reduce:scale-100!">
          <Icon aria-hidden className="size-8" />
        </span>
        <span className="mt-2 block text-title text-text-1">{title}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-body-s text-text-2">
          {done && <Check aria-hidden className="size-4 shrink-0 text-text-1" />}
          <span className="truncate">{state}</span>
        </span>
      </Link>
    </div>
  );
}

/**
 * "Finish setting up" on the home page of a new account that hasn't finished its first run: its own server, what the
 * profile hears and reads, its history — each tile leads to its step (the setup screen with that dialog open, or the
 * import). "Hide" finishes it for the account at once, with "Undo". While it is here the starter isn't (one
 * introduction at a time).
 */
export function SetupShelf({ state }: { state: SetupState }) {
  const t = useTranslations("setup");
  const { me } = useSession();
  const audioValue = useAudioValue();
  const [gone, setGone] = useState(false);
  const setDone = (on: boolean) => api("/api/setup/done", { method: on ? "POST" : "DELETE" });
  const hide = useAction({
    run: () => setDone(true),
    optimistic: () => {
      setGone(true);
      return () => setGone(false);
    },
    success: t("shelfHidden"),
    undo: () => setDone(false),
  });
  const p = me?.activeProfile;
  if (gone || !p) return null;
  return (
    <Row
      id="setup"
      kind="landscape"
      title={t("shelfTitle")}
      actions={
        <Button size="sm" variant="secondary" onClick={() => void hide.run()}>
          {t("shelfHide")}
        </Button>
      }
    >
      <Tile
        href="/setup?open=server"
        icon={Server}
        title={t("server")}
        done={state.servers.length > 0}
        state={state.servers.length > 0 ? state.servers.join(", ") : t("serverNone")}
      />
      <Tile href="/setup?open=audio" icon={Languages} title={t("languages")} state={audioValue(p, false)} />
      <Tile href="/import" icon={History} title={t("history")} done={state.imported} state={state.imported ? t("historyDone") : t("historySources")} />
    </Row>
  );
}
