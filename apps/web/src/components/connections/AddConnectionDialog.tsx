"use client";

import type { ConnectionCredentials, ConnectionSummary, ProviderAuth, ProviderKind } from "@lumovio/contracts";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Input, PasswordInput } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { forgetCredentials } from "@/lib/media/clients";
import { jellyfinClient, jellyfinLogin, jellyfinPublicInfo, jellyfinQuickConnect } from "@/lib/media/jellyfin";
import { isPrivateHost, MediaNetError, mixedContentBlocked, type NetErrorCode, refineAddressError } from "@/lib/media/net";
import { type PlexResource, plexPickConnection, plexPollPin, plexResources, plexStartPin } from "@/lib/media/plex";
import { torrServerClient } from "@/lib/media/torrserver";
import { Diagnosis } from "./ConnectionHelp";
import { netErrorText } from "./net-errors";
import { ServerMark } from "./ServerMark";

const KINDS: ProviderKind[] = ["jellyfin", "plex", "torrserver"];

/**
 * Adding a server, and changing the address or sign-in of one (design-system 7.9; audit SRV-02, SRV-05, SRV-06).
 * Adding is two steps: the type (with its mark and what it is for), then the form of that type — its own title, its
 * own hints, "Check and save". Changing is the same form, filled in, for one server: a new address is checked with
 * the sign-in it has unless a new one is typed. Credentials typed here go straight from this device to the user's
 * server; Lumovio receives only the resulting token (Jellyfin/Plex) or, for TorrServer (Basic auth only), the
 * encrypted login.
 */
export function AddConnectionDialog({ edit, onClose, onDone }: { edit?: ConnectionSummary; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("connections");
  const tc = useTranslations("common");
  const [kind, setKind] = useState<ProviderKind | null>(edit?.kind ?? null);
  const [name, setName] = useState(edit?.name ?? "");
  const [url, setUrl] = useState(edit?.baseUrl ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ url?: string; username?: string; password?: string; form?: string; code?: NetErrorCode }>({});
  const [qcCode, setQcCode] = useState<string | null>(null);
  const [plexServers, setPlexServers] = useState<PlexResource[] | null>(null);
  const [plexToken, setPlexToken] = useState<string | null>(null);
  const cancelled = useRef(false);
  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  const normalized = () => url.trim().replace(/\/+$/, "");
  // Whether the typed host name exists at all (SRV-02): a typo then reads "server not found", not a certificate problem.
  const lookupHost = async (u: string) => (await api<{ found: boolean | null }>("/api/connections/lookup", { method: "POST", json: { url: u } })).found;
  /** A failure in words, at the field it is about: wrong sign-in at the password, the rest under the form. */
  const fail = async (err: unknown) => {
    const refined = await refineAddressError(err, normalized(), lookupHost);
    const text = netErrorText(t, refined, normalized());
    if (refined instanceof MediaNetError && refined.code === "auth") setErrors({ password: text });
    else if (refined instanceof MediaNetError && refined.code === "not_found") setErrors({ url: text });
    // A network failure comes with what to try (./ConnectionHelp `Diagnosis`); anything else is said as it is.
    else setErrors({ form: text, code: refined instanceof MediaNetError ? refined.code : undefined });
  };
  // Each server type starts clean: an error of one type or step is not carried to another.
  const chooseKind = (k: ProviderKind | null) => {
    setKind(k);
    setErrors({});
    setQcCode(null);
  };

  const finish = (message: string) => {
    toast.success(message);
    onDone();
  };

  /** Saves a new server with the check that just passed, so it starts "Online", not "Not checked" (SRV-08). */
  async function create(auth: ProviderAuth, baseUrl: string, displayName: string, version: string | null = null, latencyMs: number | null = null) {
    const c = await api<ConnectionSummary>("/api/connections", { method: "POST", json: { kind: auth.kind, name: displayName.slice(0, 60) || t(`kind_${auth.kind}`), baseUrl, auth } });
    try {
      const latency = latencyMs === null ? null : Math.round(latencyMs);
      await api(`/api/connections/${c.id}/check`, { method: "POST", json: { status: latency !== null && latency > 2500 ? "degraded" : "ok", detail: version, serverVersion: version, latencyMs: latency } });
    } catch {
      // The server is added; only its status stays "Not checked" until the next check.
    }
    finish(t("added", { name: displayName || t(`kind_${auth.kind}`) }));
  }

  /** Saves a changed server: the address and name, and the sign-in if a new one was made; the check that passed. */
  async function update(c: ConnectionSummary, patch: { baseUrl?: string; auth?: ProviderAuth }, version: string | null, latencyMs: number | null) {
    await api(`/api/connections/${c.id}`, { method: "PATCH", json: { name: name.trim() || c.name, ...patch } });
    if (patch.baseUrl) await api(`/api/connections/${c.id}/check`, { method: "POST", json: { status: "ok", detail: version, serverVersion: version, latencyMs } });
    // The old address and sign-in are dropped from this page and from the offline worker.
    forgetCredentials(c.id);
    navigator.serviceWorker?.controller?.postMessage({ type: "lumovio:forget-credentials" });
    finish(t("changed", { name: name.trim() || c.name }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const u = normalized();
    // Checked on submit, said at the field (one model for forms, AUTH-04).
    const found = {
      url: !u ? t("urlMissing") : !/^https?:\/\/[^/\s]+/i.test(u) ? t("urlInvalid") : undefined,
      username: kind === "jellyfin" && !edit && !username.trim() ? t("usernameMissing") : undefined,
    };
    setErrors(found);
    if (found.url || found.username) return;
    setBusy(true);
    try {
      // A public http:// address can't be reached from a secure page at all. One on this device or the home network is
      // tried: Chrome and Edge (Local Network Access, 142+) reach it once the person allows it (lib/media/net
      // `mediaFetch`); a browser that refuses it says so then (errMixedContentLan, errLocalNetwork).
      if (mixedContentBlocked(u) && !isPrivateHost(u)) {
        throw new MediaNetError("mixed_content", "Blocked: HTTP server on an HTTPS page");
      }
      if (kind === "jellyfin") {
        const info = await jellyfinPublicInfo(u);
        if (edit && !username.trim()) {
          // A new address with the sign-in it has: checked with that token.
          const { auth } = await api<ConnectionCredentials>(`/api/connections/${edit.id}/credentials`);
          if (auth.kind !== "jellyfin") throw new Error("kind");
          const r = await jellyfinClient(u, auth).test();
          await update(edit, { baseUrl: u }, r.version ?? null, r.latencyMs);
        } else {
          const r = await jellyfinLogin(u, username, password);
          setPassword("");
          const auth: ProviderAuth = { kind: "jellyfin", userId: r.userId, accessToken: r.accessToken, serverId: r.serverId, serverName: info.ServerName };
          if (edit) await update(edit, { baseUrl: u, auth }, info.Version ?? null, null);
          else await create(auth, u, name.trim() || info.ServerName, info.Version ? `Jellyfin ${info.Version}` : null);
        }
      } else if (kind === "torrserver") {
        const typed = Boolean(username || password);
        let auth: ProviderAuth = { kind: "torrserver", username: username || null, password: password || null };
        if (edit && !typed) {
          const creds = await api<ConnectionCredentials>(`/api/connections/${edit.id}/credentials`);
          auth = creds.auth;
        }
        if (auth.kind !== "torrserver") throw new Error("kind");
        const r = await torrServerClient(u, auth).test();
        if (edit) await update(edit, { baseUrl: u, ...(typed ? { auth } : {}) }, r.version ?? null, r.latencyMs);
        else await create(auth, u, name.trim() || "TorrServer", r.version ?? null, r.latencyMs);
      } else if (kind === "plex" && edit) {
        // Plex picks its address itself: only the name changes here.
        await update(edit, {}, null, null);
      }
    } catch (err) {
      await fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function quickConnect() {
    const u = normalized();
    if (!u) return setErrors({ url: t("urlMissing") });
    setErrors({});
    setBusy(true);
    try {
      const info = await jellyfinPublicInfo(u);
      const qc = await jellyfinQuickConnect(u);
      if (!qc) {
        setErrors({ form: t("errQuickConnectOff") });
        return;
      }
      setQcCode(qc.code);
      for (let i = 0; i < 120 && !cancelled.current; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const r = await qc.poll();
        if (r) {
          const auth: ProviderAuth = { kind: "jellyfin", userId: r.userId, accessToken: r.accessToken, serverId: r.serverId, serverName: info.ServerName };
          if (edit) await update(edit, { baseUrl: u, auth }, info.Version ?? null, null);
          else await create(auth, u, name.trim() || info.ServerName, info.Version ? `Jellyfin ${info.Version}` : null);
          return;
        }
      }
    } catch (err) {
      await fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function plexSignIn() {
    setErrors({});
    setBusy(true);
    const popup = window.open("about:blank", "plex-auth", "width=600,height=720");
    try {
      const pin = await plexStartPin();
      if (popup) popup.location.href = pin.authUrl;
      else window.open(pin.authUrl, "_blank", "noopener");
      for (let i = 0; i < 120 && !cancelled.current; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const token = await plexPollPin(pin.id);
        if (token) {
          popup?.close();
          setPlexToken(token);
          setPlexServers(await plexResources(token));
          return;
        }
      }
    } catch (err) {
      popup?.close();
      setErrors({ form: netErrorText(t, err) });
    } finally {
      setBusy(false);
    }
  }

  async function pickPlex(r: PlexResource) {
    setBusy(true);
    setErrors({});
    try {
      const uri = await plexPickConnection(r);
      if (!uri) throw new MediaNetError("timeout", "No connection of the server answered");
      await create(
        { kind: "plex", authToken: plexToken!, machineIdentifier: r.clientIdentifier, serverAccessToken: r.accessToken, connections: r.connections.slice(0, 20).map((c) => ({ uri: c.uri, local: c.local, relay: c.relay })) },
        uri,
        name.trim() || r.name,
      );
    } catch (err) {
      setErrors({ form: netErrorText(t, err) });
    } finally {
      setBusy(false);
    }
  }

  // The title says the step (SRV-05): the choice, then the server type, or the server being changed.
  const title = edit ? t("editTitle", { name: edit.name }) : kind ? t("addKind", { kind: t(`kind_${kind}`) }) : t("add");
  const description = edit ? undefined : kind ? t(`kindHint_${kind}`) : t("chooseKind");
  const back = edit ? (
    <Button variant="secondary" disabled={busy} onClick={onClose}>
      {tc("cancel")}
    </Button>
  ) : (
    <Button variant="secondary" disabled={busy} onClick={() => chooseKind(null)}>
      {tc("back")}
    </Button>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()} title={title} description={description} size="lg">
      {!kind ? (
        <ul className="grid gap-3 sm:grid-cols-3">
          {KINDS.map((k) => {
            return (
              <li key={k}>
                {/* A tile per server type; each opens its own form. */}
                <button /* ui-lint-ignore raw-button: a server-type tile (icon, name, hint) that opens its form, 7.16 */
                  type="button"
                  onClick={() => chooseKind(k)}
                  className="flex h-full w-full flex-col gap-2 rounded-md border border-line-2 p-4 text-start transition-colors duration-fast ease-fast hover:bg-surface-2"
                >
                  <span className="flex items-center gap-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-surface-2 text-text-2">
                      <ServerMark kind={k} />
                    </span>
                    <span className="flex-1 text-title text-text-1">{t(`kind_${k}`)}</span>
                    <ChevronRight aria-hidden className="size-5 text-text-3" />
                  </span>
                  <span className="text-body-s text-text-2">{t(`kindHint_${k}`)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : kind === "plex" && !edit ? (
        <div className="flex flex-col gap-4">
          {!plexServers ? (
            <>
              <p className="text-body text-text-2">{t("plexSteps")}</p>
              <div>
                <Button onClick={() => void plexSignIn()} loading={busy} autoFocus>
                  {t("plexSignIn")}
                </Button>
              </div>
              {busy && <p role="status" className="text-body-s text-text-2">{t("plexWaiting")}</p>}
            </>
          ) : plexServers.length === 0 ? (
            <p className="text-body text-text-2">{t("plexNoServers")}</p>
          ) : (
            <div>
              <p className="mb-2 text-body-s font-semibold text-text-1">{t("plexChooseServer")}</p>
              <ul className="flex flex-col gap-2">
                {plexServers.map((r) => (
                  <li key={r.clientIdentifier}>
                    <button /* ui-lint-ignore raw-button: a choice row (server name + connections) */ type="button" disabled={busy} onClick={() => void pickPlex(r)} className="w-full rounded-sm border border-line p-3 text-start transition-colors duration-fast ease-fast hover:bg-surface-2">
                      <span className="text-title text-text-1">{r.name}</span>
                      <span className="block text-body-s text-text-2">{t("plexConnections", { count: r.connections.length })}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
          <p className="text-body-s text-text-2">{t("plexUnverified")}</p>
          <DialogActions>{back}</DialogActions>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
          {kind !== "plex" && (
            <Field label={t("url")} hint={t(`urlHint_${kind}`)} error={errors.url}>
              {(id, d, invalid) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  invalid={invalid}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  placeholder="https://"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              )}
            </Field>
          )}
          {kind !== "plex" && (
            <>
              {edit && <p className="text-body-s text-text-2">{t("editSignInHint")}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={kind === "torrserver" || edit ? `${t("username")} (${tc("optional")})` : t("username")} error={errors.username}>
                  {(id, d, invalid) => <Input id={id} aria-describedby={d} invalid={invalid} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />}
                </Field>
                <Field label={kind === "torrserver" || edit ? `${t("password")} (${tc("optional")})` : t("password")} error={errors.password}>
                  {(id, d, invalid) => <PasswordInput id={id} aria-describedby={d} invalid={invalid} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />}
                </Field>
              </div>
              <p className="text-body-s text-text-2">{kind === "torrserver" ? t("passwordNoteTorrServer") : t("passwordNote")}</p>
            </>
          )}
          <Field label={`${t("name")} (${tc("optional")})`} hint={edit ? undefined : t("nameHint")}>
            {(id, d) => (
              <Input id={id} aria-describedby={d} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus={kind === "plex"} />
            )}
          </Field>
          {qcCode && (
            <div role="status" className="rounded-md bg-accent-soft p-4 text-center">
              <p className="text-body-s text-text-2">{t("quickConnectCode")}</p>
              <p className="mt-2 text-h2 tabular-nums tracking-widest text-text-1">{qcCode}</p>
            </div>
          )}
          {/* The error with the steps to try (C132): "Server didn't answer" → is it on, open the address here, away from home… */}
          {errors.code ? <Diagnosis failure={errors.code} kind={kind} address={normalized()} /> : errors.form && <InlineAlert tone="danger">{errors.form}</InlineAlert>}
          <DialogActions className="flex-wrap">
            {back}
            {kind === "jellyfin" && (
              <Button variant="secondary" onClick={() => void quickConnect()} disabled={busy}>
                {t("quickConnect")}
              </Button>
            )}
            <Button type="submit" loading={busy}>
              {kind === "plex" ? tc("save") : t("checkAndSave")}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
