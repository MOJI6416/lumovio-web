import type { ListDetails } from "@lumovio/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListView } from "@/components/library/ListView";
import { SignInColumn } from "@/components/library/SignInColumn";
import { ApiRequestError } from "@/lib/api";
import { pageSeo } from "@/lib/seo";
import { getMeState, serverApi } from "@/lib/server-api";

type Params = Promise<{ locale: string; id: string }>;

async function load(id: string): Promise<ListDetails | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  try {
    return await serverApi<ListDetails>(`/api/lists/${id}`);
  } catch (e) {
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  let l: ListDetails | null = null;
  try {
    l = await load(id);
  } catch {
    // No title tag then; the page itself shows the failure (error.tsx).
  }
  if (!l) return {};

  const { locale } = await params;
  return {
    title: l.name,
    description: l.description ?? undefined,
    robots: l.visibility === "public" ? undefined : { index: false },
    // Only a public list has an address for search and previews (SH-13).
    ...(l.visibility === "public" ? pageSeo(locale, `/lists/${l.id}`) : {}),
  };
}

export default async function ListPage({ params }: { params: Params }) {
  const { id } = await params;
  const list = await load(id);
  // A guest with a link to a list that isn't open to everyone: sign in, then back here (LIB-18, AUTH-02).
  if (!list && /^[0-9a-f-]{36}$/.test(id) && !(await getMeState())) return <SignInColumn reason="listOpen" />;
  if (!list) notFound();
  return (
    // The Collection template on the page gutter (5.3, X-02); ListView brings the page header.
    <div className="page-x mx-auto max-w-media">
      <ListView initial={list} />
    </div>
  );
}
