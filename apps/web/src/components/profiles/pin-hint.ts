import type { PinHintState, Profile } from "@lumovio/contracts";

type Lockable = Pick<Profile, "isKids" | "hasPin">;

/**
 * The adult profile "Set PIN" opens (design-system 8.10): the first adult profile without a PIN, while the account
 * has a kids profile. null when there is no kids profile or every adult profile has a PIN.
 */
export function adultWithoutPin<P extends Lockable>(profiles: readonly P[]): P | null {
  if (!profiles.some((p) => p.isKids)) return null;
  return profiles.find((p) => !p.isKids && !p.hasPin) ?? null;
}

/**
 * Whether Who's watching? shows "Set a PIN on adult profiles". Not in a kids session: it can't set a PIN (profiles are
 * managed in an adult one) and has nothing to close — leaving it already asks for a PIN, the password or a code. Shown
 * with no profile chosen yet (right after signing in): that is where an unprotected adult profile opens, and the server
 * can't tell a parent from a child there. Not while "Not now" holds (`snoozedUntil` ahead), nor when that state
 * couldn't be read (`hint` null).
 */
export function showPinHint({
  profiles,
  active,
  hint,
  now = Date.now(),
}: {
  profiles: readonly Lockable[];
  active: Pick<Profile, "isKids"> | null;
  hint: PinHintState | null;
  now?: number;
}): boolean {
  if (active?.isKids || !hint) return false;
  if (hint.snoozedUntil && Date.parse(hint.snoozedUntil) > now) return false;
  return adultWithoutPin(profiles) !== null;
}
