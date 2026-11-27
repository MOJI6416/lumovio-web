import { sitemapApi, sitemapFiles, sitemapIndex, xmlResponse } from "@/lib/sitemap";

export const dynamic = "force-dynamic"; // SITE_URL and the API are the server's runtime settings

/** The sitemap's index: the site's pages, then the titles' and the people's files (lib/sitemap.ts). */
export async function GET() {
  const counts = await sitemapApi<{ titles: number; people: number }>("");
  return xmlResponse(sitemapIndex(sitemapFiles(counts)), counts !== null);
}
