/**
 * Where the focus goes after a key in a one-row group with a roving tab stop (tabs, segmented control):
 * ←/→ step (mirrored in right-to-left text) and wrap around, Home/End jump to the ends, ↑/↓ step too when
 * `upDown` is set (a radio group, WAI-ARIA). Disabled items are skipped. `null`: the key is not for the group.
 */
export function rovingIndex(
  current: number,
  key: string,
  count: number,
  { rtl = false, upDown = false, disabled }: { rtl?: boolean; upDown?: boolean; disabled?: (i: number) => boolean } = {},
): number | null {
  if (count <= 0) return null;
  const enabled = (i: number) => !disabled?.(i);
  const walk = (from: number, step: 1 | -1) => {
    for (let n = 1; n <= count; n++) {
      const i = (((from + step * n) % count) + count) % count;
      if (enabled(i)) return i;
    }
    return null;
  };
  const next = rtl ? -1 : 1;
  switch (key) {
    case "ArrowRight":
      return walk(current, next);
    case "ArrowLeft":
      return walk(current, next === 1 ? -1 : 1);
    case "ArrowDown":
      return upDown ? walk(current, 1) : null;
    case "ArrowUp":
      return upDown ? walk(current, -1) : null;
    case "Home":
      return walk(-1, 1);
    case "End":
      return walk(count, -1);
    default:
      return null;
  }
}
