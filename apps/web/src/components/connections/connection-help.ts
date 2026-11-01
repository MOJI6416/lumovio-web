import type { ProviderKind } from "@lumovio/contracts";
import { isPrivateHost, type NetErrorCode } from "@/lib/media/net";

/** The port Tailscale Serve is pointed at in the help, per server type (their defaults). */
export const DEFAULT_PORT: Record<ProviderKind, number> = { jellyfin: 8096, plex: 32400, torrserver: 8090 };

/**
 * What to do about a failed connection, as steps (keys of `connectionHelp`), by what went wrong, the server type and
 * its address: the short diagnostics under an error (the "add server" dialog, a server's row and panel). Each step is
 * one thing to try; the last one leads further when the first ones don't help.
 */
export function diagnosisSteps(failure: NetErrorCode, kind: ProviderKind, address: string | null): string[] {
  switch (failure) {
    case "timeout":
    case "unreachable":
      return address ? ["stepServerOn", "stepOpenAddress", "stepSameNetwork"] : ["stepServerOn", "stepSameNetwork"];
    case "local_network":
      return ["lnaBlocked"];
    case "mixed_content":
      // Chrome and Edge reach an http:// address of the home network after the permission; a public one never.
      return address && isPrivateHost(address) ? ["stepLnaAllow", "stepUseHttps"] : ["stepUseHttps"];
    case "cors":
      return kind === "plex" ? ["stepRestart"] : [`tip_${kind}`];
    case "tls":
      return ["stepCertificate"];
    case "auth":
      return ["stepSignIn"];
    case "not_found":
      return ["stepSpelling", "stepTailnet"];
    case "http":
      return ["stepRestart"];
  }
}
