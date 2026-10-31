import type { Me } from "@lumovio/contracts";

/** Whether the active profile is offered anime (design-system 8.14). A guest is, and so is a session without a profile. */
export const showsAnime = (me: Me | null | undefined): boolean => me?.activeProfile?.showAnime !== false;
