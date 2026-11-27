import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ArtImage } from "@lumovio/contracts";
import { IMAGE_SOURCES } from "@lumovio/contracts/images";
import { afterEach, describe, expect, it } from "vitest";
import { artImage, backdropSrcSet, fanartSrcSet, posterSrcSet, tmdbImage } from "@/lib/images";

/** The width a browser picks from a `w`-descriptor srcset for a slot of `need` device pixels. */
const pick = (srcset: string, need: number) => {
  const c = srcset.split(", ").map((s) => {
    const [url, w] = s.split(" ");
    return { url: url!, w: Number.parseInt(w!, 10) };
  });
  return (c.find((x) => x.w >= need) ?? c.at(-1)!).url.split("/")[5];
};

describe("backdropSrcSet", () => {
  const set = backdropSrcSet("/abc.jpg")!;

  it("a 1080p screen or TV gets TMDB's 1920 px copy, not the 4K original", () => {
    expect(pick(set, 1920)).toBe("w1920");
    expect(pick(set, 1536)).toBe("w1920");
  });

  it("only screens needing more than 1920 device pixels get the original", () => {
    expect(pick(set, 3840)).toBe("original");
    expect(pick(set, 2560)).toBe("original");
  });

  it("phones keep the small copies", () => {
    expect(pick(set, 780)).toBe("w780");
    expect(pick(set, 1170)).toBe("w1280");
  });

  it("no path, no srcset", () => {
    expect(backdropSrcSet(null)).toBeUndefined();
  });
});

const fanartLogo: ArtImage = {
  source: "fanart",
  path: null,
  url: "https://assets.fanart.tv/fanart/movies/603/hdmovielogo/the-matrix.png",
  previewUrl: "https://assets.fanart.tv/bigpreview/movies/603/hdmovielogo/the-matrix.png",
  aspectRatio: 800 / 310,
  lang: "en",
  copyright: null,
};

describe("addresses of TMDB's paths, as answers have always given them", () => {
  it("are TMDB's CDN in the size asked", () => {
    expect(tmdbImage("/abc.jpg", "w342")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(tmdbImage(null, "w342")).toBeNull();
    expect(posterSrcSet("/p.jpg")).toBe(
      "https://image.tmdb.org/t/p/w185/p.jpg 185w, https://image.tmdb.org/t/p/w342/p.jpg 342w, https://image.tmdb.org/t/p/w500/p.jpg 500w, https://image.tmdb.org/t/p/w780/p.jpg 780w",
    );
    expect(backdropSrcSet("/b.jpg")).toBe(
      "https://image.tmdb.org/t/p/w780/b.jpg 780w, https://image.tmdb.org/t/p/w1280/b.jpg 1280w, https://image.tmdb.org/t/p/w1920/b.jpg 1920w, https://image.tmdb.org/t/p/original/b.jpg 3840w",
    );
  });

  it("Fanart.tv art given as full addresses keeps them", () => {
    expect(artImage(fanartLogo, "w500")).toBe(fanartLogo.url);
    expect(artImage(fanartLogo, "w92", true)).toBe(fanartLogo.previewUrl);
    expect(fanartSrcSet(fanartLogo, 800)).toBe(`${fanartLogo.previewUrl} 400w, ${fanartLogo.url} 800w`);
    const tmdbLogo: ArtImage = { ...fanartLogo, source: "tmdb", path: "/l.png", url: null, previewUrl: null };
    expect(artImage(tmdbLogo, "w500")).toBe("https://image.tmdb.org/t/p/w500/l.png");
    expect(fanartSrcSet(tmdbLogo, 800)).toBeUndefined();
  });
});

describe("another source's picture", () => {
  it("is built from its own host: its small copy for small slots, else the original", () => {
    const ref = "fanart:/movies/603/movieposter/the-matrix.jpg";
    expect(tmdbImage(ref, "w185")).toBe("https://assets.fanart.tv/bigpreview/movies/603/movieposter/the-matrix.jpg");
    expect(tmdbImage(ref, "w780")).toBe("https://assets.fanart.tv/fanart/movies/603/movieposter/the-matrix.jpg");
    expect(posterSrcSet(ref)).toBe(
      "https://assets.fanart.tv/bigpreview/movies/603/movieposter/the-matrix.jpg 400w, https://assets.fanart.tv/fanart/movies/603/movieposter/the-matrix.jpg 1000w",
    );
    expect(backdropSrcSet("fanart:/movies/603/moviebackground/b.jpg")).toBe(
      "https://assets.fanart.tv/bigpreview/movies/603/moviebackground/b.jpg 400w, https://assets.fanart.tv/fanart/movies/603/moviebackground/b.jpg 1920w",
    );
  });

  it("art with a path is built from it", () => {
    const withPath: ArtImage = { ...fanartLogo, path: "/movies/603/hdmovielogo/the-matrix.png", url: null, previewUrl: null };
    expect(artImage(withPath, "w500")).toBe(fanartLogo.url);
    expect(artImage(withPath, "w92", true)).toBe(fanartLogo.previewUrl);
  });
});

describe("the one setting", () => {
  const saved = { tmdb: IMAGE_SOURCES.tmdb.base, fanart: IMAGE_SOURCES.fanart.base };
  const set = (tmdb: string, fanart: string) => {
    (IMAGE_SOURCES.tmdb as { base: string }).base = tmdb;
    (IMAGE_SOURCES.fanart as { base: string }).base = fanart;
  };
  afterEach(() => set(saved.tmdb, saved.fanart));

  it("moves every address of a source when its host changes", () => {
    set("https://img.example/tmdb", "https://img.example/fanart");
    const all = [
      tmdbImage("/abc.jpg", "w342"),
      posterSrcSet("/p.jpg"),
      backdropSrcSet("/b.jpg"),
      artImage({ ...fanartLogo, source: "tmdb", path: "/l.png", url: null, previewUrl: null }, "w500"),
      tmdbImage("fanart:/x.png", "w500"),
      artImage({ ...fanartLogo, path: "/x.png" }, "w500"),
      fanartSrcSet({ ...fanartLogo, path: "/x.png" }, 800),
    ].join(" ");
    expect(all).not.toMatch(/tmdb\.org|fanart\.tv/);
    expect(tmdbImage("/abc.jpg", "w342")).toBe("https://img.example/tmdb/w342/abc.jpg");
    expect(tmdbImage("fanart:/x.png", "w500")).toBe("https://img.example/fanart/fanart/x.png");
  });

  it("is the only place in the site's code that names an image host", () => {
    const src = fileURLToPath(new URL("../src", import.meta.url));
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(f) ? [p] : [];
      });
    const naming = files(src).filter((f) => /image\.tmdb\.org|assets\.fanart\.tv/.test(readFileSync(f, "utf8")));
    expect(naming).toEqual([]);
  });
});
