"use client";

import type { ProfileApprovalDetails } from "@lumovio/contracts";
import { Tv, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { FocusCard } from "@/components/shell/FocusCard";
import { SavedCheck } from "@/components/ui/BrandMotion";
import { Button, buttonClass } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link } from "@/i18n/navigation";

type Checked = { kind: "device" } | { kind: "approval"; details: ProfileApprovalDetails };

/**
 * Phone side of a TV's code (S28, the Focus template): type the code shown on the TV, check it, then decide — only after
 * an explicit "Sign in on this TV". The same field takes the code a TV shows to leave a kids profile (TV document §7.1
 * item 5): it then asks "Allow «Kid» → «Anna» on the TV?" and switches only that TV's profile. The code is checked on
 * submit with the reason at the field (AUTH-04).
 */
export function LinkDevice({ initialCode, approve: approveCode }: { initialCode: string; approve?: string }) {
  const t = useTranslations("tv");
  const ts = useTranslations("shell");
  const tr = useTranslations();
  const [code, setCode] = useState((approveCode ?? initialCode).toUpperCase());
  const [checked, setChecked] = useState<Checked | null>(null);
  const [state, setState] = useState<"idle" | "checked" | "approved" | "denied">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  // No connection is said as such, not as a wrong code, and never leaves the button spinning (8.5).
  const request = async (input: string, init?: RequestInit) => {
    try {
      return await fetch(input, { credentials: "same-origin", ...init });
    } catch {
      setError(tr("errors.network"));
      return null;
    }
  };
  const check = async (e: FormEvent) => {
    e.preventDefault();
    if (clean.length < 8) return setError(clean ? t("codeShort") : t("codeMissing"));
    setBusy(true);
    setError(null);
    // A TV's sign-in code first; else the code of a TV asking to leave a kids profile.
    const r = await request(`/api/auth/device?user_code=${encodeURIComponent(clean)}`);
    if (r?.ok) {
      setBusy(false);
      setChecked({ kind: "device" });
      setState("checked");
      return;
    }
    if (!r) return setBusy(false);
    const a = await request(`/api/approvals/${encodeURIComponent(clean)}`);
    setBusy(false);
    if (a?.ok) {
      const details = (await a.json()) as ProfileApprovalDetails;
      if (details.status !== "pending") return setError(t("invalidCode"));
      setChecked({ kind: "approval", details });
      setState("checked");
    } else if (a) setError(t("invalidCode"));
  };
  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    const r =
      checked?.kind === "approval"
        ? await request(`/api/approvals/${encodeURIComponent(clean)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ approve }) })
        : await request(`/api/auth/device/${approve ? "approve" : "deny"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userCode: clean }) });
    setBusy(false);
    if (r?.ok) setState(approve ? "approved" : "denied");
    else if (r) setError(t("invalidCode"));
  };

  const approval = checked?.kind === "approval" ? checked.details : null;
  const title = approval ? t("approveTitle") : t("linkTitle");

  if (state === "approved" || state === "denied")
    return (
      <FocusCard icon={Tv} title={title}>
        <div className="flex w-full flex-col gap-5">
          <p className="flex items-center justify-center gap-2 text-body font-semibold text-text-1" role="status">
            {state === "approved" ? <SavedCheck /> : <XCircle aria-hidden className="size-5 text-text-2" />}
            {approval ? (state === "approved" ? t("approveDone", { name: approval.to.name }) : t("approveRefused")) : state === "approved" ? t("approved") : t("denied")}
          </p>
          <Link href="/" className={buttonClass("primary", "lg", "w-full")}>
            {ts("toHome")}
          </Link>
        </div>
      </FocusCard>
    );

  // The Focus template (design-system 9): a 440 card over the stage, the page's h1 on it.
  return (
    <FocusCard
      icon={Tv}
      title={title}
      text={
        state !== "checked"
          ? t("linkText")
          : approval
            ? t("approveText", { device: approval.device, from: approval.from?.name ?? "—", to: approval.to.name })
            : t("linkConfirm", { code: clean })
      }
      form={
        state === "idle" && (
          <form onSubmit={(e) => void check(e)} noValidate className="flex w-full flex-col gap-5">
            <Field label={t("codeLabel")} error={error}>
              {(id, d, invalid) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  invalid={invalid}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  autoComplete="one-time-code"
                  autoCapitalize="characters"
                  spellCheck={false}
                  size="lg"
                  autoFocus={!initialCode && !approveCode}
                  // A code field: large even figures with spacing (4.1: no monospace).
                  className="text-center text-h3 tabular-nums tracking-widest"
                  maxLength={9}
                />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {t("checkCode")}
            </Button>
          </form>
        )
      }
    >
      {state !== "idle" && (
        <div className="flex w-full flex-col gap-2">
          {error && (
            <p role="alert" className="text-body-s text-danger">
              {error}
            </p>
          )}
          <Button size="lg" loading={busy} onClick={() => void decide(true)}>
            {approval ? t("approveAllow") : t("approve")}
          </Button>
          <Button variant="tertiary" disabled={busy} onClick={() => void decide(false)}>
            {t("deny")}
          </Button>
        </div>
      )}
    </FocusCard>
  );
}
