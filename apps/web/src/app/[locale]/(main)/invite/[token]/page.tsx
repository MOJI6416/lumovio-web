import type { ListInvitePreview } from "@lumovio/contracts";
import { getTranslations } from "next-intl/server";
import { FocusColumn, ListCover } from "@/components/library/FocusColumn";
import { InviteAccept } from "@/components/library/InviteAccept";
import { SignInColumn } from "@/components/library/SignInColumn";
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

const wide = buttonClass("primary", "lg", "w-full");

/**
 * An invitation to a shared list (S32; LIB-19; design-system 9 "Library"): one question on the page's background — the
 * list's cover, "You're invited to «X»", whose it is and how many titles, what joining lets you do — then "Join" and
 * "Not now". A link that opens nothing says so at once with the way on; a kids profile hears the real reason (kids
 * profiles don't join shared lists) and can switch profiles; a guest signs in first and comes back here.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getMeState();
  const t = await getTranslations("library");
  const tc = await getTranslations("common");
  if (!me) {
    // A guest learns at once that a link doesn't work (LIB-30) — the API says only that, nothing of the list; a working
    // one (or no answer) gets the sign-in, back here afterwards (AUTH-02).
    const valid = await serverApi<{ valid: boolean }>(`/api/invites/${encodeURIComponent(token)}/status`).then(
      (s) => s.valid,
      (e) => (e instanceof ApiRequestError && e.status === 400 ? false : null),
    );
    if (valid === false) {
      const ts = await getTranslations("shell");
      return (
        <FocusColumn title={t("inviteInvalidTitle")} text={t("inviteInvalidText")}>
          <Link href="/" className={wide}>
            {ts("toHome")}
          </Link>
        </FocusColumn>
      );
    }
    return <SignInColumn reason="invite" next={`/invite/${token}`} />;
  }
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
      <FocusColumn title={t("inviteKidsTitle")} text={t("inviteKidsText")}>
        <Link href="/profiles" className={wide}>
          {t("switchProfile")}
        </Link>
      </FocusColumn>
    );
  }
  const invite = await load(token);
  if (invite === "unavailable") return unavailable;
  if (!invite) {
    return (
      <FocusColumn title={t("inviteInvalidTitle")} text={t("inviteInvalidText")}>
        <Link href="/library?tab=lists" className={wide}>
          {t("toMyLists")}
        </Link>
      </FocusColumn>
    );
  }
  const facts = [t("ownerIs", { name: invite.owner }), tc("titlesCount", { count: invite.itemCount })].join(" · ");
  const cover = <ListCover cover={invite.cover} />;
  if (invite.memberRole) {
    return (
      <FocusColumn cover={cover} title={t("inviteAlreadyTitle", { list: invite.name })} text={facts}>
        <Link href={`/lists/${invite.listId}`} className={wide}>
          {t("openList")}
        </Link>
      </FocusColumn>
    );
  }
  return (
    <FocusColumn
      cover={cover}
      title={t("inviteToList", { list: invite.name })}
      text={
        <>
          <span className="block">{facts}</span>
          <span className="mt-1 block">{invite.role === "editor" ? t("inviteAsEditor") : t("inviteAsViewer")}</span>
        </>
      }
    >
      <InviteAccept token={token} />
    </FocusColumn>
  );
}
