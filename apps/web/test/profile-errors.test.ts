import { describe, expect, it } from "vitest";
import de from "../messages/de.json";
import en from "../messages/en.json";
import es from "../messages/es.json";
import fr from "../messages/fr.json";
import it_ from "../messages/it.json";
import pl from "../messages/pl.json";
import ptBR from "../messages/pt-BR.json";
import ru from "../messages/ru.json";
import tr from "../messages/tr.json";
import uk from "../messages/uk.json";
import { codeSendErrorText, profileErrorText } from "../src/components/profiles/profile-errors";
import { ApiRequestError } from "../src/lib/api";

// The key itself stands for its text: what matters is which words the person gets.
const t = ((key: string) => key) as unknown as Parameters<typeof profileErrorText>[0];
const err = (code: ConstructorParameters<typeof ApiRequestError>[1], status = 403) => new ApiRequestError(status, code, "Some English sentence");

describe("leaving the kids profile with a mailed code: errors in words", () => {
  it("a wrong, used or expired code is said as such, not as a wrong password", () => {
    expect(profileErrorText(t, err("password_required"), "code")).toBe("wrongCode");
    expect(profileErrorText(t, err("bad_request", 400), "code")).toBe("wrongCode");
    expect(profileErrorText(t, err("password_required"), "password")).toBe("wrongPassword");
    expect(profileErrorText(t, err("rate_limited", 429), "code")).toBe("tooManyAttempts");
  });

  it("a code that couldn't be mailed: too many, offline, or the mail failed", () => {
    expect(codeSendErrorText(t, err("rate_limited", 429))).toBe("tooManyAttempts");
    expect(codeSendErrorText(t, err("network", 0))).toBe("errNetwork");
    for (const code of ["upstream_unavailable", "not_configured", "internal", "bad_request"] as const) {
      expect(codeSendErrorText(t, err(code, 500))).toBe("codeSendFailed");
    }
    expect(codeSendErrorText(t, new Error("boom"))).toBe("codeSendFailed");
  });

  it("every string of the dialog is in every interface language", () => {
    const keys = ["codeTitle", "codeIntro", "codeSent", "codeResent", "codeLabel", "sendCode", "useCode", "usePassword", "wrongCode", "codeSendFailed", "leaveKidsHint", "leaveKidsHintNoPassword"];
    for (const [lang, m] of Object.entries({ en, ru, uk, de, es, fr, it: it_, pl, "pt-BR": ptBR, tr })) {
      const profiles = (m as { profiles: Record<string, string> }).profiles;
      for (const k of keys) expect(profiles[k], `${lang} profiles.${k}`).toBeTruthy();
      // The old "sign out and sign in again" dialog is gone everywhere.
      expect(profiles.noPasswordTitle, lang).toBeUndefined();
      expect(profiles.codeIntro, lang).toContain("{name}");
    }
  });
});
