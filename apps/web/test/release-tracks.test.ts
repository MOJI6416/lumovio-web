import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ api: vi.fn() }));
vi.mock("../src/lib/media/clients", () => ({ getCredentials: vi.fn() }));

const { compactTracks, hidesStudios } = await import("../src/lib/media/release-tracks");
const { fileTracks, parseRelease, rankReleases } = await import("../src/lib/media/releases");
const { unplayedHashes, UNPLAYED_MINUTES } = await import("../src/lib/media/torrent-manage");

const owner = ["rus|MVO, HDRezka Studio", "rus|MVO, LostFilm", "rus|MVO, NewComers", "rus|MVO, TVShows", "rus|MVO [Red Head Sound]", "rus|Дубляж, HDRezka Studio", "ukr|Дубляж", "eng|Original"];

describe("the shared cache keeps what the pick needs (torr-system 2026-11-08)", () => {
  it("compacts a file's tracks to language, kind and studio, and reads back the same tracks", () => {
    const compact = compactTracks(owner, "en");
    expect(compact).toEqual(["ru|mvo, HDrezka Studio", "ru|mvo, LostFilm", "ru|mvo, NewComers", "ru|mvo, TVShows", "ru|mvo, Red Head Sound", "ru|dub, HDrezka Studio", "uk|dub", "en|original"]);
    const back = fileTracks(compact, "en");
    expect(back.map((t) => [t.language, t.voice, t.studio ?? t.credit, t.original])).toEqual(fileTracks(owner, "en").map((t) => [t.language, t.voice, t.studio ?? t.credit, t.original]));
  });

  it("drops anything that is not a word of a track's credit", () => {
    expect(compactTracks(["rus|MVO <script>/etc/passwd</script>"], null)[0]).toMatch(/^ru\|[\p{L}\p{N} .,'&+()!-]*$/u);
  });

  it("reads ahead only a name that hides its studios", () => {
    const x = (title: string) => ({ info: parseRelease(title, "rutracker.org", "en") });
    expect(hidesStudios(x("F1 / F1 (2025) WEB-DL 2160p | 3x Dub + 6x MVO + AVO"))).toBe(true);
    expect(hidesStudios(x("Аркейн / Arcane [S02] (2024) WEB-DL 1080p | многоголосый"))).toBe(true);
    expect(hidesStudios(x("F1 (2025) WEB-DL 1080p | MVO (LostFilm)"))).toBe(false);
  });

  it("a cached read gives a counted release its studios in the ranking", () => {
    const r = { title: "F1 / F1 (2025) WEB-DL 2160p HDR | 3x Dub + 6x MVO", link: "x", hash: null, size: 30e9, seeders: 40, peers: 1, tracker: "rutracker.org", published: null };
    const d = { title: "F1", originalTitle: "F1", kind: "movie" as const, year: 2025, originalLanguage: "en" };
    const prefs = { languages: ["ru"], studios: ["LostFilm"], quality: "auto" as const, device: { hevc: true, hdr: true, uhd: true, dolbyVision: false } };
    expect(rankReleases([r], d, prefs)[0]!.studio).toBeNull();
    expect(rankReleases([r], d, prefs, null, null, () => compactTracks(owner, "en"))[0]!.studio).toBe("LostFilm");
  });
});

describe("unplayed copies are swept", () => {
  const now = Date.UTC(2026, 10, 8, 12);
  const t = (hash: string, mark: object | null) => ({ hash: hash.repeat(40), title: "x", data: mark ? JSON.stringify({ lumovio: mark }) : undefined });
  it("takes only what Lumovio added, marked unplayed, older than the limit", () => {
    const old = now - (UNPLAYED_MINUTES + 1) * 60_000;
    const list = [
      t("a", { titleId: "movie:1", addedAt: old, played: false }),
      t("b", { titleId: "movie:1", addedAt: old, played: true }),
      t("c", { titleId: "movie:1", addedAt: now - 60_000, played: false }),
      t("d", { titleId: "movie:1" }),
      t("e", null),
    ];
    expect(unplayedHashes(list, now)).toEqual(["a".repeat(40)]);
  });
});
