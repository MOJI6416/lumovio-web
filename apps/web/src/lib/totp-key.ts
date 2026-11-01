/**
 * The setup key inside an `otpauth://totp/…?secret=…` address — what an authenticator app takes by hand when the QR
 * code can't be scanned (the app is on the phone showing it). Empty if the address has none.
 */
export function totpSecret(uri: string): string {
  try {
    return (new URL(uri).searchParams.get("secret") ?? "").replace(/\s+/g, "").toUpperCase();
  } catch {
    return "";
  }
}

/** The key in groups of four, as authenticator apps print it; the apps ignore the spaces. */
export function groupKey(key: string): string {
  return key.match(/.{1,4}/g)?.join(" ") ?? "";
}
