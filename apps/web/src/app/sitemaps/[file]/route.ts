import { pageEntries, personEntries, sitemapApi, titleEntries, urlset, xmlResponse } from "@/lib/sitemap";

export const dynamic = "force-dynamic"; // SITE_URL and the API are the server's runtime settings

/** One file of the sitemap: `pages.xml`, `titles-<n>.xml` or `people-<n>.xml`. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (file === "pages.xml") return xmlResponse(urlset(pageEntries()), true);
  const m = /^(titles|people)-([1-9]\d{0,4})\.xml$/.exec(file);
  if (!m) return new Response("Not found", { status: 404 });
  if (m[1] === "titles") {
    const list = await sitemapApi<{ titles: Parameters<typeof titleEntries>[0] }>(`/titles/${m[2]}`);
    if (!list) return new Response("Unavailable", { status: 503, headers: { "retry-after": "300" } });
    return xmlResponse(urlset(titleEntries(list.titles)), true);
  }
  const list = await sitemapApi<{ people: Parameters<typeof personEntries>[0] }>(`/people/${m[2]}`);
  if (!list) return new Response("Unavailable", { status: 503, headers: { "retry-after": "300" } });
  return xmlResponse(urlset(personEntries(list.people)), true);
}
