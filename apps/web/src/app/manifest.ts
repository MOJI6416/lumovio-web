import type { MetadataRoute } from "next";
import en from "../../messages/en.json";
import { webManifest } from "@/lib/web-manifest";

/** /manifest.webmanifest — the English pages' manifest; /<locale>/manifest.webmanifest has the others (L10N-10). */
export default function manifest(): MetadataRoute.Manifest {
  return webManifest({ lang: "en", locale: "en", description: en.common.tagline });
}
