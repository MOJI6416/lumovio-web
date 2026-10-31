import { notFound } from "next/navigation";

/**
 * Any address no route claims (/ru/no-such-page, /ru/a/b/c, an unknown language prefix) gets the
 * branded 404 of app/[locale]/not-found.tsx in the visitor's language, with status 404 (SH-01, 8.5).
 */
export default function UnknownAddress() {
  notFound();
}
