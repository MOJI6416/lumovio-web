"use client";

import type { SetupState } from "@lumovio/contracts";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { SettingsLink, SettingsSection } from "@/components/ui/Settings";
import { useProfilePrefs } from "@/components/settings/ProfileSettings";
import { useAudioValue, useLanguageList } from "@/components/settings/profile-values";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAction } from "@/lib/use-action";

// The sub-screens load when one is opened, as in the settings they come from.
const AudioDialog = dynamic(() => import("@/components/settings/ProfileDialogs").then((m) => m.AudioDialog), { ssr: false });
const SubtitlesDialog = dynamic(() => import("@/components/settings/ProfileDialogs").then((m) => m.SubtitlesDialog), { ssr: false });
const AddConnectionDialog = dynamic(() => import("@/components/connections/AddConnectionDialog").then((m) => m.AddConnectionDialog), { ssr: false });

export type SetupOpen = "audio" | "subtitles" | "server" | null;

export const setupQuery = { queryKey: ["setup"], queryFn: () => api<SetupState>("/api/setup") };

/**
 * "Let's set up Lumovio" — a new account's first run: what the profile hears and reads, its own server and its history,
 * as rows with their values, each with a visible line for someone new here; everything can be skipped. "Done" finishes
 * it for the account (no home shelf after), "Later" leaves the shelf; both go where the person was going (`next`).
 * Opening the screen marks it seen, so "Who's watching?" doesn't send here again.
 */
export function SetupScreen({ initial, next, open: openFirst }: { initial: SetupState; next: string; open: SetupOpen }) {
  const t = useTranslations("setup");
  const ts = useTranslations("settings");
  const router = useRouter();
  const { profile, value, change } = useProfilePrefs();
  const list = useLanguageList();
  const audioValue = useAudioValue();
  const [open, setOpen] = useState<SetupOpen>(openFirst);
  const q = useQuery({ ...setupQuery, initialData: initial });

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on arrival
  useEffect(() => {
    // Seen: the shelf takes over from here. A failure only means the picker may send here once more.
    if (initial.offer === "screen") void api("/api/setup/seen", { method: "POST" }).catch(() => {}); // ui-lint-ignore swallowed-error: unseen only means the picker may send here once more
  }, []);

  // A refusal says why in a toast and the screen stays.
  const done = useAction({ run: () => api("/api/setup/done", { method: "POST" }) });
  const finish = async () => {
    if ((await done.run()).ok) router.replace(next);
  };

  if (!profile || !value) return null;
  const servers = q.data.servers;
  const close = () => setOpen(null);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-h1 text-balance text-text-1">{t("title")}</h1>
        <p className="mt-2 text-body text-text-2">{t("lead")}</p>
      </div>
      <SettingsSection>
        <SettingsLink
          label={ts("audioRow")}
          detail={t("audioDetail")}
          value={<span className="truncate">{audioValue(value, false)}</span>}
          opens
          onClick={() => setOpen("audio")}
        />
        <SettingsLink
          label={ts("subtitlesRow")}
          detail={t("subtitlesDetail")}
          value={<span className="truncate">{list(value.subtitleLanguages)}</span>}
          opens
          onClick={() => setOpen("subtitles")}
        />
        <SettingsLink
          label={t("server")}
          detail={t("serverDetail")}
          value={<span className="truncate">{servers.length > 0 ? servers.join(", ") : t("serverNone")}</span>}
          opens
          onClick={() => setOpen("server")}
          after={
            <div className="pb-3">
              <Link variant="action" arrow href="/about#servers">
                {t("serverWhat")}
              </Link>
            </div>
          }
        />
        <SettingsLink label={t("history")} detail={t("historyDetail")} value={q.data.imported ? t("historyDone") : undefined} href="/import" />
      </SettingsSection>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="max-sm:w-full" disabled={done.pending} onClick={() => void finish()}>
          {t("done")}
        </Button>
        <Button size="lg" variant="secondary" className="max-sm:w-full" onClick={() => router.replace(next)}>
          {t("later")}
        </Button>
      </div>
      {open === "audio" && <AudioDialog value={value} change={change} kids={false} onClose={close} />}
      {open === "subtitles" && <SubtitlesDialog value={value} change={change} onClose={close} />}
      {open === "server" && (
        <AddConnectionDialog
          onClose={close}
          onDone={() => {
            close();
            void q.refetch();
          }}
        />
      )}
    </div>
  );
}
