import { describe, expect, it } from "vitest";
import { withJellyfinKey } from "../src/lib/media/jellyfin";

describe("the Jellyfin token in an address", () => {
  it("adds both keys to an address without them", () => {
    expect(withJellyfinKey("https://jf/Videos/1/stream?static=true", "t k")).toBe("https://jf/Videos/1/stream?static=true&ApiKey=t%20k&api_key=t%20k");
    expect(withJellyfinKey("https://jf/Items/1/Images/Primary", "t")).toBe("https://jf/Items/1/Images/Primary?ApiKey=t&api_key=t");
  });
  it("never repeats a key the server's own address has (its HLS playlist answers 401 to a second ApiKey)", () => {
    expect(withJellyfinKey("https://jf/videos/1/master.m3u8?DeviceId=d&ApiKey=t&Tag=x", "t")).toBe("https://jf/videos/1/master.m3u8?DeviceId=d&ApiKey=t&Tag=x&api_key=t");
    expect(withJellyfinKey("https://jf/videos/1/master.m3u8?api_key=t&ApiKey=t", "t")).toBe("https://jf/videos/1/master.m3u8?api_key=t&ApiKey=t");
  });
});
