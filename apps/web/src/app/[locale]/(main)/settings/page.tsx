import { signInFirst } from "@/components/profiles/AdultOnly";
import { ProfileSettings } from "@/components/settings/ProfileSettings";

/**
 * /settings: on a desktop the Profile section beside the menu; below lg the list of sections (SettingsFrame), Profile
 * being /settings/profile there. The tab says "Settings · Lumovio", true for both.
 */
export default async function Page() {
  await signInFirst("/settings");
  return <ProfileSettings />;
}
