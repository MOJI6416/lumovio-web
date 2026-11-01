import { describe, expect, it } from "vitest";
import { diagnosisSteps } from "../src/components/connections/connection-help";

/** The steps under a failed connection (C105): what to try, by what went wrong, the server type and its address. */
describe("diagnosisSteps", () => {
  it("leads an unanswered server through on → open it here → away from home", () => {
    expect(diagnosisSteps("timeout", "jellyfin", "http://192.168.1.10:8096")).toEqual(["stepServerOn", "stepOpenAddress", "stepSameNetwork"]);
    expect(diagnosisSteps("unreachable", "torrserver", null)).toEqual(["stepServerOn", "stepSameNetwork"]);
  });

  it("offers the local network permission only for an address of the home network", () => {
    expect(diagnosisSteps("mixed_content", "torrserver", "http://192.168.1.10:8090")).toEqual(["stepLnaAllow", "stepUseHttps"]);
    expect(diagnosisSteps("mixed_content", "torrserver", "http://torr.example.org")).toEqual(["stepUseHttps"]);
    expect(diagnosisSteps("local_network", "plex", "https://10-0-0-5.abc.plex.direct:32400")).toEqual(["lnaBlocked"]);
  });

  it("says each server type's own CORS pitfall", () => {
    expect(diagnosisSteps("cors", "jellyfin", null)).toEqual(["tip_jellyfin"]);
    expect(diagnosisSteps("cors", "torrserver", null)).toEqual(["tip_torrserver"]);
    expect(diagnosisSteps("cors", "plex", null)).toEqual(["stepRestart"]);
  });

  it("has a step for every other failure", () => {
    expect(diagnosisSteps("tls", "jellyfin", null)).toEqual(["stepCertificate"]);
    expect(diagnosisSteps("auth", "jellyfin", null)).toEqual(["stepSignIn"]);
    expect(diagnosisSteps("not_found", "jellyfin", null)).toEqual(["stepSpelling", "stepTailnet"]);
    expect(diagnosisSteps("http", "torrserver", null)).toEqual(["stepRestart"]);
  });
});
