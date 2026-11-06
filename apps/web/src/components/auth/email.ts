/*
 * The first profile's name from the address. A plain module: the unit tests import it (the inboxes are in inboxes.ts,
 * which only "Check your email" loads).
 */

/**
 * The first profile's name, from the address: "ivan.petrov88@…" → "Ivan". Sign-up asks only what signing in needs —
 * the address and a password; the name is changed with the profile ("Manage profiles"), as any other.
 */
export function nameFromEmail(email: string) {
  const local = email.split("@")[0]?.split("+")[0] ?? "";
  const word = local.split(/[._-]+/).find((w) => /\p{L}/u.test(w)) ?? local;
  const name = word.replace(/\d+$/, "") || word || "Me";
  return (name.charAt(0).toLocaleUpperCase() + name.slice(1)).slice(0, 40);
}
