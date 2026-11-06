/*
 * "Open email" on "Check your email": the web inbox of the address's mail service. A plain module: the unit tests
 * import it.
 */

// The web inbox of the common mail services, for "Open email" — the one thing to do after a letter went out.
const INBOXES: [string[], string][] = [
  [["gmail.com", "googlemail.com"], "https://mail.google.com/mail/u/0/#inbox"],
  [["outlook.com", "hotmail.com", "live.com", "msn.com"], "https://outlook.live.com/mail/0/"],
  [["icloud.com", "me.com", "mac.com"], "https://www.icloud.com/mail/"],
  [["yahoo.com"], "https://mail.yahoo.com/"],
  [["proton.me", "protonmail.com", "pm.me"], "https://mail.proton.me/"],
  [["ukr.net"], "https://mail.ukr.net/"],
  [["yandex.ru", "yandex.ua", "yandex.com", "ya.ru"], "https://mail.yandex.ru/"],
  [["mail.ru", "inbox.ru", "list.ru", "bk.ru"], "https://e.mail.ru/inbox/"],
  [["gmx.de", "gmx.net"], "https://www.gmx.net/"],
  [["web.de"], "https://web.de/"],
  [["wp.pl"], "https://poczta.wp.pl/"],
  [["onet.pl"], "https://poczta.onet.pl/"],
];

/** The web inbox for the address's mail service, or null for any other. */
export function inboxOf(email: string): string | null {
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  return INBOXES.find(([domains]) => domains.includes(domain))?.[1] ?? null;
}
