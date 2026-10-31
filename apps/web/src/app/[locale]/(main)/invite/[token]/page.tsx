import type { ListInvitePreview } from "@lumovio/contracts";
import { Baby, Link2Off, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { InviteAccept } from "@/components/library/InviteAccept";
import { FocusCard } from "@/components/shell/FocusCard";
import { GuestGatePanel } from "@/components/shell/GuestGate";
import { ServiceUnavailable } from "@/components/shell/ServiceUnavailable";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Link } from "@/i18n/navigation";
import { ApiRequestError } from "@/lib/api";
import { getMeState, serverApi } from "@/lib/server-api";

export async function generateMetadata() {
  const t = await getTranslations("library");
  return { title: t("joinTitle"), robots: { index: false } };
}

/** `null` — the link doesn't open anything (unknown, used up, expired). */
async function load(token: string): Promise<ListInvitePreview | null | "unavailable"> {
  try {
    return await serverApi<ListInvitePreview>(`/api/invites/${encodeURIComponent(token)}`);
  } catch (e) {
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 400)) return null;
    return "unavailable";
  }
}

/**
 * An invitation to a shared list (S32, Focus template; LIB-19): what it is for — the list, its owner, its size and the
 * role — before "Join"; a link that opens nothing says so at once, with the way on; a kids profile is told the real
 * reason (kids profiles don't join shared lists) and can switch profiles.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getMeState();
  if (!me) {
    // A guest learns at once that a link doesn't work (LIB-30) — the API says only that, nothing of the list; a working
    // one (or no answer) gets the one sign-in page, back here afterwards (AUTH-02).
    const valid = await serverApi<{ valid: boolean }>(`/api/invites/${encodeURIComponent(token)}/status`).then(
      (s) => s.valid,
      (e) => (e instanceof ApiRequestError && e.status === 400 ? false : null),
    );
    if (valid === false) {
      const tl = await getTranslations("library");
      const ts = await getTranslations("shell");
      return (
        <FocusCard icon={Link2Off} title={tl("inviteInvalidTitle")} text={tl("inviteInvalidText")}>
          <Link href="/" className={buttonClass("primary")}>
            {ts("toHome")}
          </Link>
        </FocusCard>
      );
    }
    return <GuestGatePanel reason="invite" next={`/invite/${token}`} variant="page" />;
  }
  const t = await getTranslations("library");
  const tc = await getTranslations("common");
  const unavailable = (
    <div className="page-x">
      <div className="mx-auto max-w-tool">
        <PageHeader title={t("joinTitle")} />
        <ServiceUnavailable />
      </div>
    </div>
  );
  if (me === "unavailable") return unavailable;
  if (me.activeProfile?.isKids) {
    return (
      <FocusCard icon={Baby} title={t("inviteKidsTitle")} text={t("inviteKidsText")}>
        <Link href="/profiles" className={buttonClass("primary")}>
          {t("switchProfile")}
        </Link>
      </FocusCard>
    );
  }
  const invite = await load(token);
  if (invite === "unavailable") return unavailable;
  if (!invite) {
    return (
      <FocusCard icon={Link2Off} title={t("inviteInvalidTitle")} text={t("inviteInvalidText")}>
        <Link href="/library?tab=lists" className={buttonClass("primary")}>
          {t("toMyLists")}
        </Link>
      </FocusCard>
    );
  }
  const facts = [t("ownerIs", { name: invite.owner }), tc("titlesCount", { count: invite.itemCount })].join(" · ");
  if (invite.memberRole) {
    return (
      <FocusCard icon={Users} title={t("inviteAlreadyTitle", { list: invite.name })} text={facts}>
        <Link href={`/lists/${invite.listId}`} className={buttonClass("primary")}>
          {t("openList")}
        </Link>
      </FocusCard>
    );
  }
  // The Focus template (design-system 9): one question on a 440 card over the stage.
  return (
    <FocusCard
      icon={Users}
      title={t("inviteToList", { list: invite.name })}
      text={
        <>
          <span className="block">{facts}</span>
          <span className="mt-1 block">{invite.role === "editor" ? t("inviteAsEditor") : t("inviteAsViewer")}</span>
        </>
      }
    >
      <InviteAccept token={token} />
    </FocusCard>
  );
}
