"use client";

import type { ConnectionSummary } from "@lumovio/contracts";
import { ListVideo, Pencil, RefreshCw, ScanLine, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useId, useState } from "react";
import { useSession } from "@/components/providers/Providers";
import { StatusBadge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Checkbox";
import { FilterChip } from "@/components/ui/Chip";
import { SidePanel } from "@/components/ui/Dialog";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Switch } from "@/components/ui/Switch";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { type SaveState, useSettingsSave } from "@/lib/use-action";
import { type ServerActions, STATUS, useServerFact } from "./server-actions";

const AddConnectionDialog = dynamic(() => import("./AddConnectionDialog").then((m) => m.AddConnectionDialog), { ssr: false });

/** A block of the panel: an h3 with "Saved" by it (8.8), its rows under it. */
function Block({ title, save, children }: { title: string; save?: SaveState; children: ReactNode }) {
  const t = useTranslations();
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 id={id} className="text-h3 text-text-1">
          {title}
        </h3>
        <span role="status" className="text-body-s text-text-2">
          {save?.status === "saving" ? t("ui.saving") : save?.status === "saved" ? t("common.saved") : ""}
        </span>
      </div>
      {save?.status === "error" && (
        <InlineAlert
          tone="danger"
          title={t("ui.saveFailed")}
          action={
            <Button variant="tertiary" size="sm" onClick={save.retry}>
              {t("common.retry")}
            </Button>
          }
        >
          {save.message}
        </InlineAlert>
      )}
      {children}
    </section>
  );
}

/**
 * The server's panel (design-system 7.9 SidePanel, 7.16; audit SRV-03, SRV-06): its state and the actions that need
 * the profile's access (check, scan or added releases), its settings and who may use it — applied at once with
 * "Saved" — the address and sign-in, changed without removing the server, and the danger zone at the end.
 */
export function ServerPanel({
  conn: c,
  access,
  actions,
  onChange,
  onClose,
}: {
  conn: ConnectionSummary;
  access: boolean;
  actions: ServerActions;
  onChange: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("connections");
  const tm = useTranslations("torrentManager");
  const fact = useServerFact();
  const { me } = useSession();
  const [editing, setEditing] = useState(false);
  const settingsSave = useSettingsSave();
  const [settings, setSettings] = useState(c.settings);
  useEffect(() => setSettings(c.settings), [c.settings]);

  const set = (patch: Partial<ConnectionSummary["settings"]>) =>
    void settingsSave.save(
      async () => {
        await api(`/api/connections/${c.id}`, { method: "PATCH", json: { settings: patch } });
        onChange();
      },
      () => {
        const before = settings;
        setSettings({ ...settings, ...patch });
        return () => setSettings(before);
      },
    );
  const hint = c.status === "unreachable" || c.status === "unauthorized" || c.status === "degraded" ? t(`statusHint_${c.status}`) : null;

  return (
    <>
      <SidePanel open={!editing} onOpenChange={(o) => !o && !editing && onClose()} title={c.name} description={`${t(`kind_${c.kind}`)} · ${c.baseUrl}`}>
        <div className="flex flex-col gap-6 pb-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {actions.busy === "test" ? (
                <StatusBadge status="neutral">{t("testing")}</StatusBadge>
              ) : (
                <StatusBadge status={STATUS[c.status] ?? "neutral"}>{t(`status_${c.status}`)}</StatusBadge>
              )}
              {/* The version the last good check saw. */}
              {(c.status === "ok" || c.status === "degraded") && c.statusDetail && <span className="text-body-s text-text-2">{c.statusDetail}</span>}
            </div>
            {fact(c, actions.scanned) && <p className="text-body-s text-text-2">{fact(c, actions.scanned)}</p>}
            {hint && <p className="text-body-s text-text-2">{hint}</p>}
            {access ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={RefreshCw} loading={actions.busy === "test"} disabled={actions.busy === "scan"} onClick={() => void actions.test()}>
                  {t("test")}
                </Button>
                {c.kind !== "torrserver" ? (
                  <Button variant="secondary" size="sm" icon={ScanLine} loading={actions.busy === "scan"} disabled={actions.busy === "test"} onClick={() => void actions.scan()}>
                    {t("sync")}
                  </Button>
                ) : (
                  <Link href={`/settings/connections/${c.id}/torrents`} className={buttonClass("secondary", "sm")}>
                    <ListVideo aria-hidden />
                    {tm("open")}
                  </Link>
                )}
              </div>
            ) : (
              // Checking, scanning and the releases work through the profile's access: said, not offered (SRV-03).
              <InlineAlert tone="info" title={t("noAccess")}>
                {t("noAccessText", { profile: me?.activeProfile?.name ?? "" })}
              </InlineAlert>
            )}
          </div>

          <Block title={t("settingsTitle")} save={settingsSave.state}>
            {c.kind !== "torrserver" ? (
              <>
                <Switch checked={settings.syncProgressToServer} onCheckedChange={(v) => set({ syncProgressToServer: v })} label={t("syncProgress")} />
                <Switch checked={settings.importWatchedFromServer} onCheckedChange={(v) => set({ importWatchedFromServer: v })} label={t("importWatched")} />
              </>
            ) : (
              <Switch checked={settings.autoSearch} onCheckedChange={(v) => set({ autoSearch: v })} label={t("autoSearch")} description={t("autoSearchHint")} />
            )}
          </Block>

          <ProfileAccess conn={c} onChange={onChange} />

          <Block title={t("addressTitle")}>
            <p className="break-all text-body text-text-1">{c.baseUrl}</p>
            <p className="text-body-s text-text-2">{access ? t("addressHint") : t("addressNoAccess")}</p>
            <Button variant="secondary" size="sm" icon={Pencil} className="self-start" disabled={!access} onClick={() => setEditing(true)}>
              {c.kind === "plex" ? t("rename") : t("editAddress")}
            </Button>
          </Block>

          <Block title={t("dangerZone")}>
            <p className="text-body-s text-text-2">{t("removeText")}</p>
            <Button
              variant="danger-tertiary"
              icon={Trash2}
              className="-ms-3 self-start"
              onClick={async () => {
                if (await actions.remove()) onClose();
              }}
            >
              {t("remove")}
            </Button>
          </Block>
        </div>
      </SidePanel>
      {editing && (
        <AddConnectionDialog
          edit={c}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            onChange();
          }}
        />
      )}
    </>
  );
}

type AccessProfile = { id: string; name: string; isKids: boolean };

/**
 * Which profiles may use a server (SRV-01). The API stores explicit grants; no grants means "every
 * adult profile, new ones included, and no kids profile". Choosing "Selected profiles" starts from the
 * adults that have it now, so nothing is revoked silently; a kids profile gets the server only when
 * ticked. At least one profile stays ticked — an empty list would mean "all adults" again.
 */
function ProfileAccess({ conn: c, onChange }: { conn: ConnectionSummary; onChange: () => void }) {
  const t = useTranslations("connections");
  const { me } = useSession();
  const profiles: AccessProfile[] = me?.profiles ?? [];
  const [ids, setIds] = useState(c.profileIds);
  const { state, save } = useSettingsSave();
  // Follow the server's list after each refresh.
  useEffect(() => setIds(c.profileIds), [c.profileIds]);
  const all = ids.length === 0;

  const apply = (next: string[]) =>
    void save(
      async () => {
        await api(`/api/connections/${c.id}`, { method: "PATCH", json: { profileIds: next } });
        onChange();
      },
      () => {
        const before = ids;
        setIds(next);
        return () => setIds(before);
      },
    );

  return (
    <Block title={t("profiles")} save={state}>
      <RadioGroup<"all" | "some">
        legend={t("profiles")}
        hideLegend
        value={all ? "all" : "some"}
        onValueChange={(v) => apply(v === "all" ? [] : profiles.filter((p) => !p.isKids).map((p) => p.id))}
        options={[
          { value: "all", label: t("accessAll"), description: t("accessAllHint") },
          { value: "some", label: t("accessSome"), description: t("accessSomeHint") },
        ]}
      />
      {!all && (
        <>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => {
              const on = ids.includes(p.id);
              return (
                <FilterChip
                  key={p.id}
                  selected={on}
                  // The last ticked profile stays: an empty list would mean "all adults" again (said below).
                  disabled={on && ids.length === 1}
                  onClick={() => apply(on ? ids.filter((x) => x !== p.id) : [...ids, p.id])}
                >
                  {p.isKids ? t("accessKidsChip", { name: p.name }) : p.name}
                </FilterChip>
              );
            })}
          </div>
          {ids.length === 1 && <p className="text-body-s text-text-2">{t("accessLast")}</p>}
        </>
      )}
    </Block>
  );
}
